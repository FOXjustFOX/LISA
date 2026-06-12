import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import * as pdfParse from "pdf-parse";
import dotenv from "dotenv";

import {
  initDatabase,
  query,
  queryOne,
  run,
  hashPassword,
  verifyPassword,
} from "./server/db";

dotenv.config();

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.error("ERROR: ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables.");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

const app = express();
const PORT = 3000;
const TOKEN_SECRET = process.env.TOKEN_SECRET || "gemini_claude_dual_secret_string_key";

// Increase body payload limits to easily handle base64 PDF attachments
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Token generation helper
function generateToken(userId: number, role: string): string {
  const payload = `${userId}:${role}:${Date.now()}`;
  const hmac = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64")}.${hmac}`;
}

// Token verification helper
function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const payload = Buffer.from(payloadB64, "base64").toString("utf-8");

    const expectedHmac = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
    if (expectedHmac !== signature) return null;

    const [userIdStr, role, timestampStr] = payload.split(":");
    const timestamp = parseInt(timestampStr, 10);
    // Token expires after 7 days
    if (Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) return null;

    return { userId: parseInt(userIdStr, 10), role };
  } catch (err) {
    return null;
  }
}

// Authentication Middlewares
async function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. Missing token." });
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
  }

  // Double check that user is active
  const user = await queryOne<{ status: string; email: string; role: string }>(
    "SELECT email, role, status FROM users WHERE id = ?",
    [decoded.userId]
  );

  if (!user || user.status === "suspended") {
    return res.status(403).json({ error: "Account suspended or deleted." });
  }

  req.user = {
    id: decoded.userId,
    email: user.email,
    role: user.role,
  };
  next();
}

async function requireAdmin(req: any, res: any, next: any) {
  await requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin resource. Access denied." });
    }
    next();
  });
}

// ==========================================
// API ROUTES
// ==========================================

// Authenticated current user check
app.get("/api/auth/me", requireAuth, (req: any, res) => {
  res.json({ user: req.user });
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const user = await queryOne<{ id: number; password_hash: string; role: string; status: string }>(
      "SELECT id, password_hash, role, status FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "This account has been suspended by an administrator." });
    }

    const matches = verifyPassword(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user.id, user.role);
    res.json({
      token,
      user: {
        id: user.id,
        email: email.trim().toLowerCase(),
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Register
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  if (password.length < 5) {
    return res.status(400).json({ error: "Password must be at least 5 characters long." });
  }

  try {
    const existing = await queryOne("SELECT id FROM users WHERE email = ?", [
      email.trim().toLowerCase(),
    ]);

    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const hash = hashPassword(password);
    
    // First user registering after system admin pre-seed becomes user, or we can check
    // If standard table is empty (though standard user admin is always pre-seeded, so role is default 'user')
    const result = await run(
      "INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'user', 'active')",
      [email.trim().toLowerCase(), hash]
    );

    const token = generateToken(result.lastID, "user");

    res.json({
      token,
      user: {
        id: result.lastID,
        email: email.trim().toLowerCase(),
        role: "user",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------
// ADMIN ENDPOINTS
// ------------------------------------------

// Fetch all system users
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await query(
      "SELECT id, email, role, status, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create user directly from Administrator Dashboard
app.post("/api/admin/users", requireAdmin, async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: "Email, password, and role are required." });
  }

  try {
    const existing = await queryOne("SELECT id FROM users WHERE email = ?", [
      email.trim().toLowerCase(),
    ]);
    if (existing) {
      return res.status(400).json({ error: "Email is already taken." });
    }

    const hash = hashPassword(password);
    await run(
      "INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, ?, 'active')",
      [email.trim().toLowerCase(), hash, role]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update user status (toggle suspend / active)
app.post("/api/admin/users/:id/toggle-status", requireAdmin, async (req: any, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: "You cannot suspend your own admin account." });
  }

  try {
    const targetUser = await queryOne<{ status: string; email: string }>(
      "SELECT status, email FROM users WHERE id = ?",
      [targetId]
    );

    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    // Special protection for seeded admin root
    if (targetUser.email === ADMIN_EMAIL) {
      return res.status(400).json({ error: "Cannot modify original master administrative credential." });
    }

    const newStatus = targetUser.status === "active" ? "suspended" : "active";
    await run("UPDATE users SET status = ? WHERE id = ?", [newStatus, targetId]);
    res.json({ success: true, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Change user role (admin <=> user)
app.post("/api/admin/users/:id/change-role", requireAdmin, async (req: any, res) => {
  const targetId = parseInt(req.params.id, 10);
  const { role } = req.body;

  if (targetId === req.user.id) {
    return res.status(400).json({ error: "You cannot change your own admin role." });
  }

  if (role !== "admin" && role !== "user") {
    return res.status(400).json({ error: "Invalid role value." });
  }

  try {
    const targetUser = await queryOne<{ email: string }>("SELECT email FROM users WHERE id = ?", [targetId]);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    if (targetUser.email === ADMIN_EMAIL) {
      return res.status(400).json({ error: "Cannot modify original master administrative credential." });
    }

    await run("UPDATE users SET role = ? WHERE id = ?", [role, targetId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete("/api/admin/users/:id", requireAdmin, async (req: any, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own admin account." });
  }

  try {
    const targetUser = await queryOne<{ email: string }>("SELECT email FROM users WHERE id = ?", [targetId]);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    if (targetUser.email === ADMIN_EMAIL) {
      return res.status(400).json({ error: "Cannot delete master administrative credential." });
    }

    // Deleting a user cascade-deletes their chats and messages in standard triggers
    await run("DELETE FROM users WHERE id = ?", [targetId]);
    await run("DELETE FROM chats WHERE user_id = ?", [targetId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Diagnostic Stats Panel
app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  try {
    const userStats = await queryOne<{ total: number }>("SELECT COUNT(*) as total FROM users");
    const chatStats = await queryOne<{ total: number }>("SELECT COUNT(*) as total FROM chats");
    const messageStats = await queryOne<{ total: number }>("SELECT COUNT(*) as total FROM messages");

    const providerStats = await query<{ provider: string; count: number }>(
      "SELECT provider, COUNT(*) as count FROM chats GROUP BY provider"
    );

    const usersByStatus = await query<{ status: string; count: number }>(
      "SELECT status, COUNT(*) as count FROM users GROUP BY status"
    );

    res.json({
      totalUsers: userStats?.total || 0,
      totalChats: chatStats?.total || 0,
      totalMessages: messageStats?.total || 0,
      providers: providerStats,
      statusBreakdown: usersByStatus,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------
// CHATS & MESSAGES ENDPOINTS
// ------------------------------------------

// Fetch chats list (only current user's chats)
app.get("/api/chats", requireAuth, async (req: any, res) => {
  try {
    const chats = await query(
      "SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(chats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create chat session
app.post("/api/chats", requireAuth, async (req: any, res) => {
  const { title, provider } = req.body;
  if (!title || !provider) {
    return res.status(400).json({ error: "Title and provider are required." });
  }

  const chatId = crypto.randomUUID();
  try {
    await run(
      "INSERT INTO chats (id, user_id, title, provider) VALUES (?, ?, ?, ?)",
      [chatId, req.user.id, title, provider]
    );

    res.json({ id: chatId, title, provider });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete chat session
app.delete("/api/chats/:id", requireAuth, async (req: any, res) => {
  const chatId = req.params.id;
  try {
    // Check ownership
    const chat = await queryOne<{ user_id: number }>("SELECT user_id FROM chats WHERE id = ?", [chatId]);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }
    if (chat.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden access" });
    }

    await run("DELETE FROM chats WHERE id = ?", [chatId]);
    await run("DELETE FROM messages WHERE chat_id = ?", [chatId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch messages of a session
app.get("/api/chats/:id/messages", requireAuth, async (req: any, res) => {
  const chatId = req.params.id;
  try {
    // Check ownership
    const chat = await queryOne<{ user_id: number }>("SELECT user_id FROM chats WHERE id = ?", [chatId]);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }
    if (chat.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden access" });
    }

    const messages = await query(
      "SELECT * FROM messages WHERE chat_id = ? ORDER BY id ASC",
      [chatId]
    );
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send a chat message (and get assistant reply)
app.post("/api/chats/:id/messages", requireAuth, async (req: any, res) => {
  const chatId = req.params.id;
  const { content, file, customGeminiKey, customClaudeKey } = req.body;

  if (!content && !file) {
    return res.status(400).json({ error: "Message content or file attachment is required." });
  }

  try {
    // Validate chat session ownership
    const chat = await queryOne<{ provider: string; user_id: number; title: string }>(
      "SELECT provider, user_id, title FROM chats WHERE id = ?",
      [chatId]
    );

    if (!chat) {
      return res.status(404).json({ error: "Chat session not found." });
    }

    if (chat.user_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    let fileText = "";
    let savedFileName: string | null = null;
    let savedFileType: string | null = null;

    // 1. Process PDF Attachment (if sent)
    if (file && file.base64) {
      savedFileName = file.name || "attachment.pdf";
      savedFileType = file.type || "application/pdf";

      try {
        const fileBuffer = Buffer.from(file.base64, "base64");
        // Only run pdf-parse if the attachment is actually pdf
        if (savedFileType.includes("pdf") || savedFileName.endsWith(".pdf")) {
          const parsedPdf = await ((pdfParse as any).default || (pdfParse as any))(fileBuffer);
          fileText = parsedPdf.text;
          console.log(`Successfully parsed PDF "${savedFileName}": Extracted ${fileText.length} characters of raw text context.`);
        } else {
          // If other textual files are uploaded, parse them simply as utf-8
          fileText = fileBuffer.toString("utf-8");
        }
      } catch (parseErr: any) {
        console.error("PDF Parsing Error:", parseErr);
        fileText = `[Parsing failed for file ${savedFileName}: ${parseErr.message}]`;
      }
    }

    // 2. Persist the human user's message in SQLite Database
    let humanFullContent = content || "";
    if (savedFileName && fileText) {
      humanFullContent = `[Attached PDF Document: "${savedFileName}"]\n\n--- DOCUMENT CONTENT START ---\n${fileText.slice(0, 150000)}\n--- DOCUMENT CONTENT END ---\n\nUser request:\n${content || "Please analyze this uploaded document."}`;
    }

    await run(
      "INSERT INTO messages (chat_id, sender, content, file_name, file_type) VALUES (?, ?, ?, ?, ?)",
      [chatId, "user", humanFullContent, savedFileName, savedFileType]
    );

    // 3. Fetch past session messages to feed context (up to nearest 20 messages for tokens health)
    const history = await query<{ sender: string; content: string }>(
      "SELECT sender, content FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT 20",
      [chatId]
    );
    // Reverse historical listing back to ascending chronological order
    const chatMessages = history.reverse();

    // 4. Run AI Agent logic based on the session provider choice
    let assistantReply = "";

    if (chat.provider === "gemini") {
      // Setup Gemini Custom/Env credentials
      const geminiApiKey = customGeminiKey || process.env.GEMINI_API_KEY;
      if (!geminiApiKey || geminiApiKey === "MY_GEMINI_API_KEY") {
        return res.status(400).json({
          error: "Gemini API key is not configured. Please supply your API key in the configuration header or the server secrets.",
        });
      }

      const client = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Format past messages according to Gemini contents parameters
      // We can map history to the correct role naming format
      const geminiContents = chatMessages.map((msg) => ({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      const modelName = "gemini-3.5-flash"; // Valid and recommended modern model selection
      const response = await client.models.generateContent({
        model: modelName,
        contents: geminiContents,
        config: {
          systemInstruction: "You are a professional, helpful assistant with deep analyzer features. You can digest whole PDF texts and provide insights with direct quotes and structured formatting, keeping answers readable, fast, and simple.",
        },
      });

      assistantReply = response.text || "Gemini completed without writing any response.";

    } else if (chat.provider === "claude") {
      // Setup Claude Custom/Env credentials
      const claudeApiKey = customClaudeKey || process.env.ANTHROPIC_API_KEY;
      if (!claudeApiKey || claudeApiKey === "MY_ANTHROPIC_API_KEY") {
        return res.status(400).json({
          error: "Claude API key is not configured. Please supply your Anthropic API key in the configuration header or the server secrets.",
        });
      }

      // Reformat historical context into Claude API's standard user/assistant schema
      const claudeMessages = chatMessages.map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      }));

      // Direct Anthropic Messages Endpoint fetch call
      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 4000,
          system: "You are a professional assistant with deep textual digestion features. You analyze uploaded PDF contents with extreme clarity.",
          messages: claudeMessages,
        }),
      });

      if (!anthropicResponse.ok) {
        const errorText = await anthropicResponse.text();
        console.error("Anthropic Claude Error Response:", errorText);
        throw new Error(`Claude API request failed: ${errorText || anthropicResponse.statusText}`);
      }

      const claudeData = await anthropicResponse.json();
      if (claudeData.content && Array.isArray(claudeData.content)) {
        assistantReply = claudeData.content
          .filter((block: any) => block.type === "text")
          .map((block: any) => block.text)
          .join("\n");
      } else {
        assistantReply = "Claude responded with empty content blocks.";
      }
    } else {
      throw new Error(`Unsupported model provider: "${chat.provider}"`);
    }

    // 5. Save assistant response into database
    await run(
      "INSERT INTO messages (chat_id, sender, content) VALUES (?, 'assistant', ?)",
      [chatId, assistantReply]
    );

    res.json({
      userMessage: {
        chat_id: chatId,
        sender: "user",
        content: humanFullContent,
        file_name: savedFileName,
        file_type: savedFileType,
      },
      assistantMessage: {
        chat_id: chatId,
        sender: "assistant",
        content: assistantReply,
      },
    });

  } catch (err: any) {
    console.error("Chat Message Execution Error:", err);
    res.status(500).json({ error: err.message || "An internal error occurred during chat reasoning." });
  }
});

// Update chat session title
app.post("/api/chats/:id/rename", requireAuth, async (req: any, res) => {
  const chatId = req.params.id;
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    const chat = await queryOne<{ user_id: number }>("SELECT user_id FROM chats WHERE id = ?", [chatId]);
    if (!chat) {
      return res.status(404).json({ error: "Chat session not found." });
    }
    if (chat.user_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    await run("UPDATE chats SET title = ? WHERE id = ?", [title, chatId]);
    res.json({ success: true, title });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// VITE OR STATIC FILE MIDDLEWARE MOUNTING
// ==========================================

async function startServer() {
  // Setup tables and seed admin user
  await initDatabase();

  if (process.env.NODE_ENV !== "production") {
    // Development mode with Vite's HMR and middleware proxy routing
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production compiled static assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Dual Chat Workspace] running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server startup failure:", err);
});
