import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  MessageSquare,
  FileText,
  Trash2,
  Edit2,
  LogIn,
  Shield,
  Key,
  LogOut,
  Plus,
  Send,
  Paperclip,
  Check,
  AlertCircle,
  Users,
  Settings,
  X,
  File,
  BarChart3,
  RefreshCw,
  Clock,
  Menu,
  ChevronRight,
  UserCheck,
  UserX,
  Lock,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { User, Chat, Message, AdminStats } from "./types";

export default function App() {
  // Authentication states
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("workspace_token"));
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Auth inputs
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Interface view states
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // File Upload states
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    base64: string;
    size: number;
  } | null>(null);
  const [isFileReading, setIsFileReading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMessageSending, setIsMessageSending] = useState(false);

  // New Chat Dialog
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [newChatProvider, setNewChatProvider] = useState<"gemini" | "claude">("gemini");

  // Edit Chat Title Mode
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitleValue, setEditingChatTitleValue] = useState("");

  // Personal (Override) API Keys
  const [customGeminiKey, setCustomGeminiKey] = useState<string>(() => localStorage.getItem("override_gemini_key") || "");
  const [customClaudeKey, setCustomClaudeKey] = useState<string>(() => localStorage.getItem("override_claude_key") || "");
  const [isKeysModalOpen, setIsKeysModalOpen] = useState(false);

  // Admin Dashboard States
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Admin User Creation Form
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false);
  const [adminNewEmail, setAdminNewEmail] = useState("");
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminNewRole, setAdminNewRole] = useState<"admin" | "user">("user");

  // Mobile drawer controls
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Scrolling reference
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistent user profiles check
  useEffect(() => {
    if (token) {
      localStorage.setItem("workspace_token", token);
      fetchCurrentUser();
    } else {
      localStorage.removeItem("workspace_token");
      setUser(null);
      setChats([]);
      setSelectedChatId(null);
    }
  }, [token]);

  // Load chat session listings and trigger correct initial select
  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user]);

  // Read message logs when selectedChatId updates
  useEffect(() => {
    if (selectedChatId) {
      loadMessages(selectedChatId);
    } else {
      setMessages([]);
    }
  }, [selectedChatId]);

  // Auto-scroll chat area to baseline
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isMessageSending]);

  // Auto-dismiss alerts
  useEffect(() => {
    if (globalError) {
      const t = setTimeout(() => setGlobalError(null), 8000);
      return () => clearTimeout(t);
    }
  }, [globalError]);

  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  const showToast = (msg: string) => setSuccessToast(msg);
  const triggerError = (msg: string) => setGlobalError(msg);

  // ------------------------------------------
  // API SERVICE CALLS
  // ------------------------------------------

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Token has expired or is invalid
        setToken(null);
      }
    } catch {
      setToken(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!loginEmail || !loginPassword) {
      setAuthError("Please fill in all credentials.");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Login credentials failed.");
        return;
      }

      setLoginEmail("");
      setLoginPassword("");
      setToken(data.token);
      showToast("Log in successful. Welcome to Dual Chat Client!");
    } catch (err: any) {
      setAuthError("Failed to communicate with authorization server.");
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("workspace_token");
    showToast("Successfully logged out.");
  };

  const loadChats = async () => {
    try {
      const res = await fetch("/api/chats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data);
        if (data.length > 0 && !selectedChatId) {
          setSelectedChatId(data[0].id);
        }
      }
    } catch {
      triggerError("Could not retrieve saved chat history.");
    }
  };

  const loadMessages = async (id: string) => {
    try {
      const res = await fetch(`/api/chats/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      triggerError("Could not load message history for this chat.");
    }
  };

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatTitle.trim()) {
      triggerError("Please specify a title for the chat.");
      return;
    }

    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newChatTitle.trim(),
          provider: newChatProvider,
        }),
      });

      if (res.ok) {
        const newChat = await res.json();
        setChats((prev) => [newChat, ...prev]);
        setSelectedChatId(newChat.id);
        setNewChatTitle("");
        setIsNewChatModalOpen(false);
        setIsMobileSidebarOpen(false);
        showToast(`Created new workspace utilizing ${newChatProvider === "gemini" ? "Google Gemini" : "Anthropic Claude"}.`);
      } else {
        const data = await res.json();
        triggerError(data.error || "Could not instantiate chat.");
      }
    } catch {
      triggerError("Network failure setting up chat session.");
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this chat history?")) return;

    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (selectedChatId === chatId) {
          const remaining = chats.filter((c) => c.id !== chatId);
          setSelectedChatId(remaining.length > 0 ? remaining[0].id : null);
        }
        showToast("Chat session deleted.");
      } else {
        triggerError("Failed to delete chat.");
      }
    } catch {
      triggerError("Network error deleting chat.");
    }
  };

  const handleRenameChatInline = async (chatId: string) => {
    if (!editingChatTitleValue.trim()) {
      setEditingChatId(null);
      return;
    }

    try {
      const res = await fetch(`/api/chats/${chatId}/rename`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: editingChatTitleValue.trim() }),
      });

      if (res.ok) {
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, title: editingChatTitleValue.trim() } : c))
        );
        showToast("Chat renamed successfully.");
      } else {
        const data = await res.json();
        triggerError(data.error || "Could not rename chat.");
      }
    } catch {
      triggerError("Error renaming chat session.");
    } finally {
      setEditingChatId(null);
    }
  };

  // ------------------------------------------
  // FILE SELECTION & DRAG DROP
  // ------------------------------------------

  const processFileRef = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      triggerError("Only PDF (.pdf) documents are sponsored for text analysis extraction in this client.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      triggerError("Maximum sponsored PDF size is 15 Megabytes.");
      return;
    }

    setIsFileReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setSelectedFile({
        name: file.name,
        type: file.type || "application/pdf",
        base64,
        size: file.size,
      });
      setIsFileReading(false);
      showToast(`Selected "${file.name}" for analysis extraction. Ready to chat!`);
    };
    reader.onerror = () => {
      triggerError("Failed to parse this file securely.");
      setIsFileReading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleNativeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFileRef(file);
    }
  };

  const handleDropPayload = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFileRef(file);
    }
  };

  // ------------------------------------------
  // LLM INFERENCE REASONING SUBMIT
  // ------------------------------------------

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatId) {
      triggerError("Please create a chat session before attempting to send messages.");
      return;
    }

    if (!messageText.trim() && !selectedFile) {
      triggerError("Type a message or load an attachment.");
      return;
    }

    const backupText = messageText.trim();
    const backupFile = selectedFile;

    // Instantly append Optimistic local messages to interface
    const optimisticUserMsg: Message = {
      id: Date.now(),
      chat_id: selectedChatId,
      sender: "user",
      content: backupFile
        ? `[Attached PDF Document: "${backupFile.name}"]\n\n(Extracted text processing...)\n\nUser request:\n${backupText || "Analyze this document"}`
        : backupText,
      file_name: backupFile ? backupFile.name : null,
      file_type: backupFile ? backupFile.type : null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setMessageText("");
    setSelectedFile(null);
    setIsMessageSending(true);

    try {
      const res = await fetch(`/api/chats/${selectedChatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: backupText,
          file: backupFile,
          customGeminiKey: customGeminiKey.trim() || undefined,
          customClaudeKey: customClaudeKey.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Replace user optimism message with server true parsed format, then append response
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== optimisticUserMsg.id)
            .concat(data.userMessage, data.assistantMessage)
        );
      } else {
        // Re-inject inputs on error so user doesn't lose text
        setMessageText(backupText);
        setSelectedFile(backupFile);
        
        // Remove optimistic
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
        triggerError(data.error || "The model agent was unable to formulate a response.");
      }
    } catch (err: any) {
      setMessageText(backupText);
      setSelectedFile(backupFile);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      triggerError("Service timeout or network pipeline connection error.");
    } finally {
      setIsMessageSending(false);
    }
  };

  // ------------------------------------------
  // OVERRIDE KEY HANDLERS (PERSISTENT CLIENT-SIDE)
  // ------------------------------------------

  const handleSaveKeysOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (customGeminiKey.trim()) {
      localStorage.setItem("override_gemini_key", customGeminiKey.trim());
    } else {
      localStorage.removeItem("override_gemini_key");
    }

    if (customClaudeKey.trim()) {
      localStorage.setItem("override_claude_key", customClaudeKey.trim());
    } else {
      localStorage.removeItem("override_claude_key");
    }

    setIsKeysModalOpen(false);
    showToast("Personal API keys successfully stored in this browser session override.");
  };

  // ------------------------------------------
  // ADMINISTRATIVE ACTION DISPATCHERS
  // ------------------------------------------

  const fetchAdminWorkspace = async () => {
    setAdminLoading(true);
    setAdminError(null);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (usersRes.ok && statsRes.ok) {
        const usersData = await usersRes.json();
        const statsData = await statsRes.json();
        setAdminUsers(usersData);
        setAdminStats(statsData);
      } else {
        setAdminError("Failed to fetch administrative logs. Access denied.");
      }
    } catch {
      setAdminError("Unable to establish admin communication tunnel.");
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminOpen && user?.role === "admin") {
      fetchAdminWorkspace();
    }
  }, [isAdminOpen]);

  const handleAdminToggleStatus = async (targetId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${targetId}/toggle-status`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAdminUsers((prev) =>
          prev.map((u) => (u.id === targetId ? { ...u, status: u.status === "active" ? "suspended" : "active" } : u))
        );
        showToast("User listing status updated successfully.");
        // Refresh statistics
        const statsRes = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setAdminStats(statsData);
        }
      } else {
        const data = await res.json();
        triggerError(data.error || "Could not modify status.");
      }
    } catch {
      triggerError("Network error modifying user settings.");
    }
  };

  const handleAdminChangeRole = async (targetId: number, currentRole: "admin" | "user") => {
    const nextRole = currentRole === "admin" ? "user" : "admin";
    if (!confirm(`Are you certain you wish to adjust this user's administrative level to "${nextRole}"?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${targetId}/change-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });

      if (res.ok) {
        setAdminUsers((prev) =>
          prev.map((u) => (u.id === targetId ? { ...u, role: nextRole } : u))
        );
        showToast("User permission tier reallocated.");
      } else {
        const data = await res.json();
        triggerError(data.error || "Failed to switch role.");
      }
    } catch {
      triggerError("Error dispatching permission change.");
    }
  };

  const handleAdminDeleteUser = async (targetId: number) => {
    if (!confirm("Are you sure you want to permanently delete this user account, and all of their historical chats and messages? This operation cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/users/${targetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setAdminUsers((prev) => prev.filter((u) => u.id !== targetId));
        showToast("User account permanently purged.");
        fetchAdminWorkspace();
      } else {
        const data = await res.json();
        triggerError(data.error || "Failed to delete user mapping.");
      }
    } catch {
      triggerError("Network error executing delete.");
    }
  };

  const handleAdminCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNewEmail.trim() || !adminNewPassword) {
      triggerError("Please fill out fully the required credentials for the new user profile.");
      return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: adminNewEmail.trim(),
          password: adminNewPassword,
          role: adminNewRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAdminNewEmail("");
        setAdminNewPassword("");
        setAdminNewRole("user");
        setIsAdminCreateOpen(false);
        showToast("New user created successfully in the directory.");
        fetchAdminWorkspace();
      } else {
        triggerError(data.error || "Failed during admin create process.");
      }
    } catch {
      triggerError("Error dispatching directory write request.");
    }
  };

  // ------------------------------------------
  // ACTIVE CHAT REFERENCE
  // ------------------------------------------
  const activeChat = chats.find((c) => c.id === selectedChatId);

  // ==========================================
  // VIEW RENDERER
  // ==========================================

  // AUTH STATE SCREEN
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans transition-all duration-300">
        <div className="absolute top-4 right-4 max-w-sm z-50">
          <AnimatePresence>
            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center md:gap-3"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <p className="font-semibold">{authError}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center items-center gap-2 mb-2">
            <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-center">
              <Sparkles className="h-7 cursor-default w-7 text-indigo-600 animate-pulse" />
            </div>
          </div>
          <h2 className="text-center text-2xl font-black text-slate-900 tracking-tight">
            Dual LLM Chat Workspace
          </h2>
          <p className="mt-1.5 text-center text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            A fast, light environment for parsing PDFs and chatting with Gemini 3.5 & Claude 3.5 Sonnet side-by-side.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 border border-slate-200 shadow-sm rounded-2xl sm:px-10">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-250 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="off"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-250 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-6 bg-slate-900 border border-slate-950 text-white rounded-xl py-3 text-sm font-bold tracking-wide shadow-sm hover:bg-slate-850 active:scale-[0.99] transition-all cursor-pointer flex justify-center items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                Access Workspace
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // CORE APPLICATION INTERFACE SCREEN (LOGGED IN)
  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-sans text-slate-900 transition-all duration-300 select-none">
      
      {/* Alert & Success Toasts */}
      <div className="absolute top-4 right-4 max-w-sm z-50 pointer-events-none space-y-2">
        <AnimatePresence>
          {globalError && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl p-4 bg-white border border-rose-250 shadow-lg text-rose-800 text-xs md:text-sm flex items-start gap-3 pointer-events-auto"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <h5 className="font-black text-rose-950 uppercase tracking-wider text-[10px] mb-0.5">Execution Failed</h5>
                <p className="font-semibold leading-relaxed">{globalError}</p>
              </div>
            </motion.div>
          )}

          {successToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl p-4 bg-white border border-emerald-250 shadow-lg text-emerald-800 text-xs md:text-sm flex items-start gap-3 pointer-events-auto"
            >
              <Check className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <h5 className="font-black text-emerald-950 uppercase tracking-wider text-[10px] mb-0.5">System Alert</h5>
                <p className="font-semibold leading-relaxed">{successToast}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* LEFT SIDEBAR (DESKTOP) */}
      <aside className="hidden md:flex md:w-80 md:flex-col bg-white border-r border-slate-200 shrink-0 select-none">
        
        {/* Workspace Brand Summary */}
        <div className="p-5 border-b border-slate-150 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-55 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-lg text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-black text-sm tracking-tight text-slate-900 uppercase">Dual-LLM Suite</span>
          </div>

          <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] uppercase font-black text-slate-400">Authenticated user</span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 truncate max-w-[140px]">{user.email}</span>
              <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded border ${
                user.role === "admin"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Action button to instigate chat sessions */}
        <div className="p-4">
          <button
            type="button"
            onClick={() => setIsNewChatModalOpen(true)}
            className="w-full bg-slate-900 text-white rounded-xl py-3 text-xs font-black tracking-wider uppercase shadow-sm border border-slate-950 hover:bg-slate-850 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Instigate Chat
          </button>
        </div>

        {/* Chats Session Ledger */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          <div className="px-2 pb-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Saved Sessions</div>
          {chats.length === 0 ? (
            <div className="p-4 text-center rounded-xl bg-slate-50 border border-slate-100 mx-2 mt-2">
              <MessageSquare className="w-5 h-5 text-slate-350 mx-auto mb-1.5" />
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">No chats found</p>
            </div>
          ) : (
            chats.map((c) => {
              const isSelected = c.id === selectedChatId;
              const isEditing = editingChatId === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedChatId(c.id)}
                  className={`group relative flex items-center justify-between rounded-xl p-3 mx-1 transition-all cursor-pointer select-none ${
                    isSelected
                      ? "bg-slate-100 font-bold border-l-4 border-slate-800 pl-2 text-slate-900 shadow-sm border border-slate-150"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {c.provider === "gemini" ? (
                      <span className="w-4 h-4 shrink-0 rounded bg-purple-50 text-[9px] font-black text-purple-600 border border-purple-200 flex items-center justify-center select-none" title="Google Gemini">G</span>
                    ) : (
                      <span className="w-4 h-4 shrink-0 rounded bg-amber-50 text-[9px] font-black text-amber-600 border border-amber-200 flex items-center justify-center select-none" title="Anthropic Claude">C</span>
                    )}

                    {isEditing ? (
                      <input
                        type="text"
                        required
                        autoFocus
                        value={editingChatTitleValue}
                        onChange={(e) => setEditingChatTitleValue(e.target.value)}
                        onBlur={() => handleRenameChatInline(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameChatInline(c.id);
                          if (e.key === "Escape") setEditingChatId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 outline-none text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-850 font-medium"
                      />
                    ) : (
                      <span className="text-xs truncate font-medium">{c.title}</span>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingChatId(c.id);
                          setEditingChatTitleValue(c.title);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white rounded border border-transparent hover:border-slate-200"
                        title="Rename Chat"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteChat(e, c.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded border border-transparent hover:border-slate-200"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Workspace Action Bottom Rails */}
        <div className="p-4 border-t border-slate-150 space-y-1 bg-slate-50">
          <button
            type="button"
            onClick={() => setIsKeysModalOpen(true)}
            className="w-full text-left font-bold text-xs text-slate-600 hover:text-slate-850 p-2.5 rounded-xl hover:bg-slate-150/50 transition-all cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-500" />
              <span>Personal Override Keys</span>
            </div>
            {(customGeminiKey || customClaudeKey) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active personal keys" />
            )}
          </button>

          {user.role === "admin" && (
            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              className="w-full text-left font-bold text-xs text-slate-600 hover:text-slate-850 p-2.5 rounded-xl hover:bg-slate-150/50 transition-all cursor-pointer flex items-center gap-2"
            >
              <Shield className="w-4 h-4 text-indigo-500" />
              <span>Diagnostic Admin Panel</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left font-bold text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50/50 p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER & DRAWER COMPONENT */}
      <div className="md:hidden flex flex-col w-full h-full">
        <header className="flex items-center justify-between bg-white px-4 py-3 border-b border-slate-200 select-none">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 mr-1"
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </button>
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
            <span className="font-extrabold text-xs tracking-wider uppercase text-slate-900">Dual LLM Chat</span>
          </div>

          <div className="flex items-center gap-2">
            {user.role === "admin" && (
              <button
                type="button"
                onClick={() => setIsAdminOpen(true)}
                className="p-1.5 rounded-lg border border-slate-150 hover:bg-slate-50 text-indigo-600"
                title="Admin Panel"
              >
                <Shield className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg border border-slate-150 hover:bg-slate-50 text-rose-600"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* MOBILE SIDEBAR PANEL (DRAWER BACKING) */}
        <AnimatePresence>
          {isMobileSidebarOpen && (
            <div className="fixed inset-0 z-50 flex">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileSidebarOpen(false)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              />

              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                className="fixed left-0 top-0 bottom-0 max-w-xs w-72 bg-white border-r border-slate-200 flex flex-col z-10"
              >
                <div className="p-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
                  <span className="font-extrabold text-xs tracking-widest text-slate-500 uppercase">Dual Session Desk</span>
                  <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 border-b border-slate-100 flex flex-col gap-1.5 m-3.5 bg-slate-50 rounded-xl border border-slate-250">
                  <span className="text-[9px] uppercase font-bold text-slate-400 leading-none">Email</span>
                  <span className="text-xs font-extrabold text-slate-800 truncate">{user.email}</span>
                </div>

                <div className="p-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewChatModalOpen(true);
                      setIsMobileSidebarOpen(false);
                    }}
                    className="w-full bg-slate-900 text-white rounded-xl py-3 text-xs font-black tracking-widest uppercase hover:bg-slate-850 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    New Workspace
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-1">
                  <div className="px-2 pb-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Saved Chats</div>
                  {chats.length === 0 ? (
                    <div className="p-4 text-center rounded-xl bg-slate-50 text-slate-400 mx-2">
                       No chats found
                    </div>
                  ) : (
                    chats.map((c) => {
                      const isSelected = c.id === selectedChatId;
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedChatId(c.id);
                            setIsMobileSidebarOpen(false);
                          }}
                          className={`flex items-center justify-between rounded-xl p-3 mx-1 cursor-pointer select-none ${
                            isSelected
                              ? "bg-slate-100 font-bold border-l-4 border-slate-800 text-slate-900 border border-slate-150"
                              : "text-slate-600 hover:bg-slate-50 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate flex-1 md:min-w-0">
                            {c.provider === "gemini" ? (
                              <span className="w-4 h-4 shrink-0 rounded bg-purple-50 text-[9px] font-black text-purple-600 border border-purple-200 flex items-center justify-center">G</span>
                            ) : (
                              <span className="w-4 h-4 shrink-0 rounded bg-amber-50 text-[9px] font-black text-amber-600 border border-amber-200 flex items-center justify-center">C</span>
                            )}
                            <span className="text-xs truncate font-medium">{c.title}</span>
                          </div>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteChat(e, c.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 ml-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-4 border-t border-slate-150 space-y-1 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      setIsKeysModalOpen(true);
                      setIsMobileSidebarOpen(false);
                    }}
                    className="w-full text-left font-bold text-xs text-slate-600 hover:text-slate-800 p-2.5 rounded-xl hover:bg-slate-150/50 flex items-center gap-2"
                  >
                    <Key className="w-4 h-4 text-slate-500" />
                    <span>Override API Keys</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left font-bold text-xs text-rose-600 p-2.5 rounded-xl flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out Account</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MOBILE CHAT LOG VIEWPORT PORTAL */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          <main className="flex-1 flex flex-col min-h-0 relative">
            
            {/* Context Header */}
            {activeChat ? (
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between shadow-xs select-none">
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-slate-800 truncate capitalize">{activeChat.title}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {activeChat.provider === "gemini" ? (
                    <span className="rounded bg-purple-50 text-[10px] font-black text-purple-700 px-2 py-0.5 border border-purple-200 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                      Google Gemini
                    </span>
                  ) : (
                    <span className="rounded bg-amber-50 text-[10px] font-black text-amber-700 px-2 py-0.5 border border-amber-200 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                      Claude 3.5
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {/* Chats messages logs for mobile scrolling */}
            <div className="flex-[4] overflow-y-auto p-4 space-y-4">
              {!activeChat ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-slate-50 rounded-2xl m-3 border border-slate-200">
                  <div className="p-3 bg-white rounded-2xl border border-slate-250 shadow-xs mb-3 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-indigo-500 animate-pulse" />
                  </div>
                  <h4 className="font-black text-slate-900 text-sm tracking-tight">Active Room Offline</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                    Select a historical session from the mobile drawer or instigate a brand new workspace matching your targets!
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 mb-1 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h5 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Beginning of Chat</h5>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Type a message below or attach a PDF document for analysis context.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isAssistant = m.sender === "assistant";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs border ${
                        isAssistant
                          ? "bg-slate-50 text-slate-900 border-slate-150 rounded-tl-sm"
                          : "bg-indigo-600 text-white border-indigo-700 rounded-tr-sm"
                      }`}>
                        {m.file_name && (
                          <div className={`flex items-center gap-2 p-2 rounded-lg text-xs mb-2 select-none ${
                            isAssistant
                              ? "bg-slate-100 border border-slate-200 text-slate-700"
                              : "bg-indigo-700/50 text-white border border-indigo-500/50"
                          }`}>
                            <FileText className="w-4 h-4 shrink-0 text-amber-500" />
                            <span className="truncate font-semibold max-w-[150px]">{m.file_name}</span>
                            <span className="text-[9px] uppercase font-black tracking-wider shrink-0 bg-slate-900/10 px-1 py-0.5 rounded">Analyzed</span>
                          </div>
                        )}
                        {isAssistant ? (
                          <MarkdownRenderer text={m.content} />
                        ) : (
                          <p className="text-xs font-semibold whitespace-pre-wrap leading-relaxed select-text">{m.content}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {isMessageSending && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl rounded-tl-sm px-4 py-3 text-xs leading-relaxed flex items-center gap-2.5">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-55 bg-indigo-600 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-55 bg-indigo-600 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-55 bg-indigo-600 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[10px] uppercase font-black text-slate-400">Model generating analysis...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Drag drop dropzone notification overlay (Mobile) */}
            {isDragOver && (
              <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-6 border-2 border-dashed border-indigo-500/50 rounded-2xl m-4 z-40 select-none">
                <div className="bg-white rounded-2xl p-6 shadow-xl text-center max-w-xs flex flex-col items-center">
                  <FileText className="w-10 h-10 text-amber-500 animate-bounce mb-3" />
                  <span className="font-extrabold text-sm uppercase tracking-wide text-slate-800">Drop PDF here</span>
                  <span className="text-[10px] text-slate-450 mt-1 uppercase tracking-widest leading-normal">Release to load text parser</span>
                </div>
              </div>
            )}

            {/* Input forms pane */}
            <footer className="p-3 border-t border-slate-200 select-none bg-slate-50">
              <div className="max-w-xl mx-auto flex flex-col gap-2">
                <AnimatePresence>
                  {selectedFile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="bg-white rounded-xl border border-slate-250 p-2.5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-200 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate leading-snug">{selectedFile.name}</p>
                          <p className="text-[9px] font-black tracking-wider text-slate-400 uppercase leading-none mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • PDF Text Ready</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleNativeFileSelect}
                    accept="application/pdf"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={!activeChat || isMessageSending}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-3 rounded-xl border border-slate-250 bg-white hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer text-slate-650 transition-all ${
                      (!activeChat || isMessageSending) ? "opacity-50 cursor-not-allowed" : "active:scale-95"
                    }`}
                    title="Upload PDF Document"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    required={!selectedFile}
                    disabled={!activeChat || isMessageSending}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={
                      !activeChat
                        ? "Open/Create workspace to send context..."
                        : selectedFile
                        ? "Explain analyzer instructions or press send..."
                        : "Post prompts to Gemini / Claude..."
                    }
                    className={`flex-1 rounded-xl border border-slate-250 bg-white px-4 py-3 text-xs md:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 placeholder-slate-405 transition-all ${
                      (!activeChat || isMessageSending) ? "bg-slate-100 opacity-60 cursor-not-allowed" : ""
                    }`}
                  />

                  <button
                    type="submit"
                    disabled={!activeChat || isMessageSending || (!messageText.trim() && !selectedFile)}
                    className={`bg-slate-900 border border-slate-950 text-white rounded-xl px-4 py-3 flex items-center justify-center cursor-pointer transition-all ${
                      (!activeChat || isMessageSending || (!messageText.trim() && !selectedFile))
                        ? "bg-slate-350 border-transparent opacity-40 cursor-not-allowed"
                        : "hover:bg-slate-850 active:scale-95"
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </footer>
          </main>
        </div>
      </div>

      {/* CENTER WORKSPACE CHAT LOGS AND INPUT FRAME (DESKTOP) */}
      <main className="hidden md:flex md:flex-1 md:flex-col md:min-w-0 bg-white relative">
        {activeChat ? (
          <header className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shadow-xs select-none">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl border border-slate-250 text-slate-700 shadow-xs flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-850 truncate tracking-tight">{activeChat.title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeChat.provider === "gemini" ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-purple-50 text-purple-700 px-3 py-1 font-black uppercase text-[10px] tracking-wider border border-purple-200">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                  <span>Google Gemini Context</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 text-amber-700 px-3 py-1 font-black uppercase text-[10px] tracking-wider border border-amber-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  <span>Anthropic Claude Context</span>
                </div>
              )}
            </div>
          </header>
        ) : null}

        {/* Chat message logs area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDropPayload}
          className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50"
        >
          {!activeChat ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto relative select-none">
              <div className="absolute -top-12 opacity-[12%] py-3 select-none pointer-events-none">
                <Sparkles className="w-24 h-24 text-slate-600 animate-pulse" />
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-250 shadow-xs z-10 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-indigo-500 animate-pulse" />
              </div>
              <h2 className="mt-4 text-sm font-black uppercase tracking-widest text-slate-900 leading-snug">Choose a Workspace</h2>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Dual Chat workspace can parse text from any loaded PDF documents and run inference models. Select an active history card or configure a new room.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 w-full">
                <div className="p-4 rounded-xl bg-white border border-slate-250 shadow-xs flex flex-col items-center">
                  <div className="p-2 rounded bg-purple-50 border border-purple-200 text-purple-600 text-xs font-black mb-1 select-none">GEMINI</div>
                  <span className="text-[10px] text-slate-505 uppercase tracking-wide leading-normal">Fast response</span>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-250 shadow-xs flex flex-col items-center">
                  <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-600 text-xs font-black mb-1 select-none">CLAUDE</div>
                  <span className="text-[10px] text-slate-505 uppercase tracking-wide leading-normal">Sonnet 3.5 precision</span>
                </div>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto select-none">
              <div className="p-3 bg-white rounded-2xl border border-slate-250 mb-3 flex items-center justify-center shadow-xs">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
              <h4 className="font-extrabold text-sm uppercase tracking-widest text-slate-800">Fresh Dialogue Room</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Connect your thoughts by posting a prompt. You can also drag and drop raw PDF files right into this viewport to extract their contents automatically!
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isAssistant = m.sender === "assistant";
              return (
                <div
                  key={m.id}
                  className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  <div className={`max-w-[75%] rounded-2xl px-5 py-4 shadow-xs border ${
                    isAssistant
                      ? "bg-white text-slate-850 border-slate-200 rounded-tl-sm font-normal"
                      : "bg-indigo-600 text-white border-indigo-700 rounded-tr-sm font-medium"
                  }`}>
                    {m.file_name && (
                      <div className={`flex items-center gap-2.5 p-2.5 rounded-lg text-xs mb-3 select-none ${
                        isAssistant
                          ? "bg-slate-50 border border-slate-200 text-slate-700"
                          : "bg-indigo-700/50 text-white border border-indigo-500/50"
                      }`}>
                        <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="truncate font-semibold max-w-[200px]">{m.file_name}</span>
                        <span className="text-[9px] uppercase font-black tracking-wider bg-slate-900/15 text-slate-800 px-1.5 py-0.5 rounded">Parsed Document context</span>
                      </div>
                    )}
                    {isAssistant ? (
                      <MarkdownRenderer text={m.content} />
                    ) : (
                      <p className="text-xs md:text-sm tracking-wide whitespace-pre-wrap leading-relaxed select-text font-normal">{m.content}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isMessageSending && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4 text-xs leading-relaxed flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">Model processing complex reasoning...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Drag drop desktop overlay indicator */}
        {isDragOver && (
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-xs flex items-center justify-center p-12 border-4 border-dashed border-indigo-500 rounded-2xl m-6 z-40 select-none pointer-events-none">
            <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-sm flex flex-col items-center">
              <FileText className="w-12 h-12 text-amber-500 animate-bounce mb-3" />
              <span className="font-extrabold text-slate-900 text-base uppercase tracking-wider">Drag Drop PDF document Detected</span>
              <span className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                Release your file to extract all pages into plain text and append as context!
              </span>
            </div>
          </div>
        )}

        {/* Input prompt bar console */}
        <footer className="p-4 border-t border-slate-200 select-none bg-slate-50">
          <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
            <AnimatePresence>
              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="bg-white rounded-xl border border-slate-250 p-3 flex items-center justify-between max-w-md shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-600 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide leading-none mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Plain text cached</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleNativeFileSelect}
                accept="application/pdf"
                className="hidden"
              />
              <button
                type="button"
                disabled={!activeChat || isMessageSending}
                onClick={() => fileInputRef.current?.click()}
                className={`p-3.5 rounded-xl border border-slate-250 bg-white hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer text-slate-600 transition-all ${
                  (!activeChat || isMessageSending) ? "opacity-40 cursor-not-allowed" : "active:scale-95"
                }`}
                title="Attach Document (.pdf only)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                required={!selectedFile}
                disabled={!activeChat || isMessageSending}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={
                  !activeChat
                    ? "Open or instigate a brand new workspace room to send message content..."
                    : selectedFile
                    ? `Instruct model regarding context of "${selectedFile.name}" and press send...`
                    : `Provide your instructions for ${activeChat.provider === "gemini" ? "Google Gemini 3.5" : "Claude 3.5 Sonnet"}...`
                }
                className={`flex-1 rounded-xl border border-slate-250 bg-white px-4 py-3.5 text-xs md:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-105 focus:ring-indigo-100 focus:border-indigo-500 placeholder-slate-405 transition-all ${
                  (!activeChat || isMessageSending) ? "bg-slate-100 opacity-60 cursor-not-allowed" : ""
                }`}
              />

              <button
                type="submit"
                disabled={!activeChat || isMessageSending || (!messageText.trim() && !selectedFile)}
                className={`bg-slate-900 border border-slate-950 text-white rounded-xl px-5 py-3.5 font-bold text-xs tracking-wider uppercase flex items-center justify-center cursor-pointer transition-all ${
                  (!activeChat || isMessageSending || (!messageText.trim() && !selectedFile))
                    ? "bg-slate-350 border-transparent opacity-40 cursor-not-allowed"
                    : "hover:bg-slate-850 active:scale-95 shadow-sm"
                }`}
              >
                <Send className="w-4 h-4 mr-1.5" />
                Submit
              </button>
            </form>
          </div>
        </footer>
      </main>

      {/* ==========================================
          MODALS & OVERLAYS LISTING
          ========================================== */}

      {/* INSTIGATE CHAT POPUP MODAL */}
      <AnimatePresence>
        {isNewChatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-xl"
            >
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
                <span className="font-extrabold text-sm uppercase tracking-wider text-slate-800">New Session Suite</span>
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateChat} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Workspace Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newChatTitle}
                    onChange={(e) => setNewChatTitle(e.target.value)}
                    placeholder="e.g., Financial Report Analysis"
                    className="w-full text-slate-850 rounded-xl border border-slate-250 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Select AI Provider
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewChatProvider("gemini")}
                      className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center ${
                        newChatProvider === "gemini"
                          ? "bg-purple-50 border-purple-300 text-purple-750 font-extrabold shadow-xs"
                          : "bg-white border-slate-250 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <Sparkles className={`w-5 h-5 mb-1.5 ${newChatProvider === "gemini" ? "text-purple-600" : "text-slate-400"}`} />
                      <span className="text-xs">Google Gemini</span>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mt-1 leading-none">Flash 3.5</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewChatProvider("claude")}
                      className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center ${
                        newChatProvider === "claude"
                          ? "bg-amber-50 border-amber-300 text-amber-750 font-extrabold shadow-sm"
                          : "bg-white border-slate-250 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <Sparkles className={`w-5 h-5 mb-1.5 ${newChatProvider === "claude" ? "text-amber-600" : "text-slate-400"}`} />
                      <span className="text-xs">Claude 3.5</span>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mt-1 leading-none">Sonnet Precision</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsNewChatModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 active:scale-95 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 border border-slate-950 text-white rounded-lg text-xs font-black tracking-widest uppercase hover:bg-slate-850 active:scale-95 cursor-pointer"
                  >
                    Create Workspace
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERRIDE PERSONAL API KEYS CONFIG MODAL */}
      <AnimatePresence>
        {isKeysModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-xl"
            >
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
                <span className="font-extrabold text-sm uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-slate-505" />
                  Override API keys
                </span>
                <button
                  type="button"
                  onClick={() => setIsKeysModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed mb-4">
                By default, this server loads configured backend credentials from local variables. Fill out override keys here to override using your own keys directly from your browser!
              </div>

              <form onSubmit={handleSaveKeysOverride} className="space-y-4">
                <div>
                  <label className="block text:[10px] md:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Override Google Gemini Key
                  </label>
                  <input
                    type="password"
                    value={customGeminiKey}
                    onChange={(e) => setCustomGeminiKey(e.target.value)}
                    placeholder={customGeminiKey ? "••••••••••••••••" : "AI Studio environment default keys active..."}
                    className="w-full text-slate-800 rounded-xl border border-slate-250 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text:[10px] md:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Override Anthropic Claude Key
                  </label>
                  <input
                    type="password"
                    value={customClaudeKey}
                    onChange={(e) => setCustomClaudeKey(e.target.value)}
                    placeholder={customClaudeKey ? "••••••••••••••••" : "Anthropic network defaults active..."}
                    className="w-full text-slate-800 rounded-xl border border-slate-250 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div className="pt-4 flex gap-3 justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomGeminiKey("");
                      setCustomClaudeKey("");
                    }}
                    className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                  >
                    Clear Overrides
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsKeysModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-slate-900 border border-slate-950 text-white rounded-lg text-xs font-black tracking-widest uppercase hover:bg-slate-850 cursor-pointer"
                    >
                      Store Keys
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADMINISTRATIVE DIAGNOSTICS & MANAGEMENT PANEL MODAL */}
      <AnimatePresence>
        {isAdminOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-200 shadow-2xl flex flex-col"
            >
              <header className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  <span className="font-extrabold text-sm uppercase tracking-wider text-slate-900">Workspace Diagnostic Admin</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminOpen(false);
                    // Clear secondary layouts inside admin panel
                    setIsAdminCreateOpen(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-150 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* METRICS ROW BENTO BOX GRID */}
                {adminStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 shadow-xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Total Users</span>
                        <Users className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="text-2xl font-black text-slate-900">{adminStats.totalUsers}</span>
                      <p className="text-[9px] text-slate-450 uppercase font-bold mt-1">Directory profiles active</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 shadow-xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Total Chat rooms</span>
                        <MessageSquare className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="text-2xl font-black text-slate-900">{adminStats.totalChats}</span>
                      <p className="text-[9px] text-slate-450 uppercase font-bold mt-1">SQLite sessions logged</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 shadow-xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Database transactions</span>
                        <BarChart3 className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="text-2xl font-black text-slate-900">{adminStats.totalMessages}</span>
                      <p className="text-[9px] text-slate-450 uppercase font-bold mt-1">Assigned message log nodes</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 shadow-xs">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Model Split</span>
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="flex items-baseline gap-2.5 mt-0.5">
                        <span className="text-xs font-black text-purple-700">
                          G: {adminStats.providers.find((p) => p.provider === "gemini")?.count || 0}
                        </span>
                        <span className="text-slate-350">|</span>
                        <span className="text-xs font-black text-amber-700">
                          C: {adminStats.providers.find((p) => p.provider === "claude")?.count || 0}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-455 font-black uppercase leading-none mt-2">Active providers logs</p>
                    </div>
                  </div>
                )}

                {/* DIRECTORY USER LIST TABLE */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
                    <div>
                      <h4 className="font-extrabold text-xs uppercase tracking-widest text-slate-800">User directory management</h4>
                      <p className="text-[10px] text-slate-450 uppercase mt-0.5 font-semibold">Track account role tiers and access states</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={fetchAdminWorkspace}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-650 cursor-pointer"
                        title="Reload directory logs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAdminCreateOpen(!isAdminCreateOpen)}
                        className="bg-indigo-600 border border-indigo-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold leading-none cursor-pointer flex items-center gap-1.5"
                      >
                        {isAdminCreateOpen ? <X className="w-3 h-3" /> : <Plus className="w-3" />}
                        Add User Account
                      </button>
                    </div>
                  </div>

                  {/* ADMIN USER CREATE EXPANSE FORM CARD */}
                  <AnimatePresence>
                    {isAdminCreateOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-b border-slate-250 bg-slate-50/40 overflow-hidden"
                      >
                        <form onSubmit={handleAdminCreateUserSubmit} className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Account Email</label>
                            <input
                              type="email"
                              required
                              value={adminNewEmail}
                              onChange={(e) => setAdminNewEmail(e.target.value)}
                              placeholder="colleague@example.com"
                              className="w-full text-slate-800 rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Set Password</label>
                            <input
                              type="password"
                              required
                              value={adminNewPassword}
                              onChange={(e) => setAdminNewPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full text-slate-800 rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Assignment Role</label>
                            <select
                              value={adminNewRole}
                              onChange={(e) => setAdminNewRole(e.target.value as any)}
                              className="w-full text-slate-800 rounded-lg border border-slate-250 bg-white px-2 py-2 text-xs"
                            >
                              <option value="user">Standard User</option>
                              <option value="admin">Administrator</option>
                            </select>
                          </div>
                          <button
                            type="submit"
                            className="bg-slate-900 border border-slate-955 text-white rounded-lg py-2.5 px-4 text-xs font-black tracking-widest uppercase hover:bg-slate-850 cursor-pointer"
                          >
                            Register account directory
                          </button>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* TABLE VIEWPORT */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-450 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                          <th className="px-6 py-3">Database Key ID</th>
                          <th className="px-6 py-3">User Email</th>
                          <th className="px-6 py-3">Permission Tier</th>
                          <th className="px-6 py-3">Diagnostics state</th>
                          <th className="px-6 py-3 text-right">Administrative controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-xs">
                        {adminLoading ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400 font-bold uppercase tracking-wider">
                              Parsing network accounts...
                            </td>
                          </tr>
                        ) : adminUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400">
                              No records found in active directory mapping.
                            </td>
                          </tr>
                        ) : (
                          adminUsers.map((u) => {
                            const isSelf = u.id === user.id;

                            return (
                              <tr key={u.id} className="hover:bg-slate-50/50 select-text">
                                <td className="px-6 py-4 font-mono font-medium text-slate-500">#{u.id}</td>
                                <td className="px-6 py-4 font-semibold text-slate-800 selection:bg-indigo-150">
                                  <div className="flex items-center gap-1.5">
                                    <span>{u.email}</span>
                                    {isSelf && (
                                      <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none shrink-0">YOU</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <button
                                    type="button"
                                    disabled={isSelf}
                                    onClick={() => handleAdminChangeRole(u.id, u.role)}
                                    className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider leading-none border transition-all ${
                                      isSelf ? "cursor-default border-slate-200 bg-slate-50" : "cursor-pointer active:scale-95"
                                    } ${
                                      u.role === "admin"
                                        ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-250"
                                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
                                    }`}
                                    title={isSelf ? "Self profiles locked" : "Toggle role permissions level"}
                                  >
                                    {u.role}
                                  </button>
                                </td>
                                <td className="px-6 py-4">
                                  <button
                                    type="button"
                                    disabled={isSelf}
                                    onClick={() => handleAdminToggleStatus(u.id)}
                                    className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider border leading-none transition-all ${
                                      isSelf ? "cursor-default border-slate-200 bg-slate-50" : "cursor-pointer active:scale-95"
                                    } ${
                                      u.status === "active"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-rose-55 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                                        : "bg-rose-50 text-rose-700 border-rose-250 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                                    }`}
                                    title={isSelf ? "Active Session Lock" : "Click to suspend/activate profile"}
                                  >
                                    {u.status}
                                  </button>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    type="button"
                                    disabled={isSelf}
                                    onClick={() => handleAdminDeleteUser(u.id)}
                                    className={`p-1.5 rounded-lg border border-transparent transition-all shrink-0 ${
                                      isSelf
                                        ? "text-slate-250 cursor-not-allowed"
                                        : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 cursor-pointer active:scale-90"
                                    }`}
                                    title={isSelf ? "You cannot self delete" : "Permanently remove user logs"}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <footer className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminOpen(false);
                    setIsAdminCreateOpen(false);
                  }}
                  className="bg-slate-900 border border-slate-950 text-white rounded-lg px-4 py-2 text-xs font-black tracking-widest uppercase hover:bg-slate-825 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Dismiss view
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
