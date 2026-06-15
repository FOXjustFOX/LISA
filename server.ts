import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

import {
  initDatabase,
  query,
  queryOne,
  run,
  hashPassword,
  verifyPassword,
} from "./server/db";
import { logger } from "./server/logger";

dotenv.config();

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  logger.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables.");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

const app = express();
const PORT = 3000;
const TOKEN_SECRET = process.env.TOKEN_SECRET || "gemini_claude_dual_secret_string_key";

// Increase body payload limits to easily handle base64 PDF attachments
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

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
    logger.warn(`Auth failed: missing token [${req.method} ${req.path}]`);
    return res.status(401).json({ error: "Unauthorized. Missing token." });
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    logger.warn(`Auth failed: invalid or expired token [${req.method} ${req.path}]`);
    return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
  }

  // Double check that user is active
  const user = await queryOne<{ status: string; email: string; role: string }>(
    "SELECT email, role, status FROM users WHERE id = ?",
    [decoded.userId]
  );

  if (!user || user.status === "suspended") {
    logger.warn(`Auth blocked: suspended/deleted user id=${decoded.userId}`);
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
      logger.warn(`Admin access denied: ${req.user.email} [${req.method} ${req.path}]`);
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
      logger.warn(`Login failed (not found): ${email}`);
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.status === "suspended") {
      logger.warn(`Login blocked (suspended): ${email}`);
      return res.status(403).json({ error: "This account has been suspended by an administrator." });
    }

    const matches = verifyPassword(password, user.password_hash);
    if (!matches) {
      logger.warn(`Login failed (wrong password): ${email}`);
      return res.status(401).json({ error: "Invalid email or password." });
    }

    logger.info(`Login success: ${email} [role=${user.role}]`);
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
// SETTINGS ENDPOINTS
// ------------------------------------------

app.get("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    const rows = await query<{ key: string; value: string }>("SELECT key, value FROM settings");
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/settings", requireAdmin, async (req: any, res) => {
  const { gemini_model, claude_model } = req.body;
  try {
    if (gemini_model) {
      await run("INSERT OR REPLACE INTO settings (key, value) VALUES ('gemini_model', ?)", [gemini_model]);
      logger.info(`Setting updated: gemini_model=${gemini_model} by ${req.user.email}`);
    }
    if (claude_model) {
      await run("INSERT OR REPLACE INTO settings (key, value) VALUES ('claude_model', ?)", [claude_model]);
      logger.info(`Setting updated: claude_model=${claude_model} by ${req.user.email}`);
    }
    res.json({ success: true });
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

    logger.info(`Chat created: "${title}" [${provider}] by user ${req.user.email}`);
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
    logger.info(`Chat deleted: ${chatId} by user ${req.user.email}`);
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

    const savedFileName: string | null = file ? (file.name || "attachment.pdf") : null;
    const savedFileType: string = file ? (file.type || "application/pdf") : "application/pdf";

    // 1. Store user message — text only, PDF sent natively to model (not extracted)
    const humanDbContent = savedFileName
      ? `[PDF: "${savedFileName}"]\n\n${content || "Please analyze this document."}`
      : (content || "");

    if (savedFileName) logger.debug(`Native PDF attached: "${savedFileName}" (${savedFileType})`);

    await run(
      "INSERT INTO messages (chat_id, sender, content, file_name, file_type) VALUES (?, ?, ?, ?, ?)",
      [chatId, "user", humanDbContent, savedFileName, savedFileName ? savedFileType : null]
    );

    // 2. Fetch history (includes current message just inserted)
    const history = await query<{ sender: string; content: string }>(
      "SELECT sender, content FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT 20",
      [chatId]
    );
    const chatMessages = history.reverse();

    // 3. Run AI
    let assistantReply = "";

    if (chat.provider === "gemini") {
      const geminiApiKey = customGeminiKey || process.env.GEMINI_API_KEY;
      if (!geminiApiKey || geminiApiKey === "MY_GEMINI_API_KEY") {
        return res.status(400).json({ error: "Gemini API key not configured." });
      }

      const client = new GoogleGenAI({ apiKey: geminiApiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });

      const geminiContents = chatMessages.map((msg, idx) => {
        const isCurrentWithFile = idx === chatMessages.length - 1 && file?.base64;
        if (isCurrentWithFile) {
          const parts: any[] = [
            { inlineData: { mimeType: savedFileType, data: file.base64 } },
            { text: content || "Please analyze this document." },
          ];
          return { role: "user", parts };
        }
        return { role: msg.sender === "user" ? "user" : "model", parts: [{ text: msg.content }] };
      });

      const modelRow = await queryOne<{ value: string }>("SELECT value FROM settings WHERE key = 'gemini_model'");
      const modelName = modelRow?.value || "gemini-2.0-flash";
      logger.debug(`Calling Gemini [${modelName}] for chat ${chatId}`);

      const response = await client.models.generateContent({
        model: modelName,
        contents: geminiContents,
        config: { systemInstruction: "You are a helpful assistant. When given a PDF, analyze it thoroughly and answer with clear, structured responses." },
      });

      assistantReply = response.text || "Gemini returned no response.";
      logger.info(`Gemini reply: ${assistantReply.length} chars for chat ${chatId}`);

    } else if (chat.provider === "claude") {
      const claudeApiKey = customClaudeKey || process.env.ANTHROPIC_API_KEY;
      if (!claudeApiKey || claudeApiKey === "MY_ANTHROPIC_API_KEY") {
        return res.status(400).json({ error: "Claude API key not configured." });
      }

      const claudeMessages = chatMessages.map((msg, idx) => {
        const isCurrentWithFile = idx === chatMessages.length - 1 && file?.base64;
        if (isCurrentWithFile) {
          const blocks: any[] = [
            { type: "document", source: { type: "base64", media_type: savedFileType, data: file.base64 } },
            { type: "text", text: content || "Please analyze this document." },
          ];
          return { role: "user", content: blocks };
        }
        return { role: msg.sender === "user" ? "user" : "assistant", content: msg.content };
      });

      const claudeModel = (await queryOne<{ value: string }>("SELECT value FROM settings WHERE key = 'claude_model'"))?.value || "claude-3-5-sonnet-latest";
      logger.debug(`Calling Claude [${claudeModel}] for chat ${chatId}`);

      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "pdfs-2024-09-25",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 4000,
          system: "You are a helpful assistant. When given a PDF, analyze it thoroughly and answer with clear, structured responses.",
          messages: claudeMessages,
        }),
      });

      if (!anthropicResponse.ok) {
        const errorText = await anthropicResponse.text();
        logger.error(`Claude API error ${anthropicResponse.status}`, errorText);
        throw new Error(`Claude API error: ${anthropicResponse.status}`);
      }

      const claudeData = await anthropicResponse.json();
      assistantReply = Array.isArray(claudeData.content)
        ? claudeData.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
        : "Claude returned no response.";
      logger.info(`Claude reply: ${assistantReply.length} chars for chat ${chatId}`);

    } else {
      throw new Error(`Unsupported provider: "${chat.provider}"`);
    }

    // 4. Save assistant response
    await run("INSERT INTO messages (chat_id, sender, content) VALUES (?, 'assistant', ?)", [chatId, assistantReply]);

    res.json({
      userMessage: { chat_id: chatId, sender: "user", content: humanDbContent, file_name: savedFileName, file_type: savedFileName ? savedFileType : null },
      assistantMessage: { chat_id: chatId, sender: "assistant", content: assistantReply },
    });

  } catch (err: any) {
    logger.error("Message handler error", { message: err.message, stack: err.stack });
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
    logger.info(`Server running at http://0.0.0.0:${PORT} [LOG_LEVEL=${process.env.LOG_LEVEL ?? "info"}]`);
  });
}

startServer().catch((err) => {
  logger.error(`Critical server startup failure: ${err.message}`);
  process.exit(1);
});
