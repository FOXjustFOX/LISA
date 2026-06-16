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
    ChevronDown,
    Download,
    Archive,
    StickyNote,
    Upload,
    Eye,
    EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { User, Chat, Message, AdminStats, AdminSettings, ShelfItem } from "./types";

export default function App() {
    // Authentication states
    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem("workspace_token"),
    );
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
    const [newChatProvider, setNewChatProvider] = useState<"gemini" | "claude">(
        "gemini",
    );

    // Edit Chat Title Mode
    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editingChatTitleValue, setEditingChatTitleValue] = useState("");

    // Personal (Override) API Keys
    const [customGeminiKey, setCustomGeminiKey] = useState<string>(
        () => localStorage.getItem("override_gemini_key") || "",
    );
    const [customClaudeKey, setCustomClaudeKey] = useState<string>(
        () => localStorage.getItem("override_claude_key") || "",
    );
    const [isKeysModalOpen, setIsKeysModalOpen] = useState(false);

    // Admin Dashboard States
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [adminUsers, setAdminUsers] = useState<User[]>([]);
    const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
    const [adminLoading, setAdminLoading] = useState(false);
    const [adminSettings, setAdminSettings] = useState<AdminSettings>({
        gemini_model: "gemini-3.5-flash",
        claude_model: "claude-3-5-sonnet-latest",
    });

    const [adminSettingsSaving, setAdminSettingsSaving] = useState(false);

    // Admin User Creation Form
    const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false);
    const [adminNewEmail, setAdminNewEmail] = useState("");
    const [adminNewUsername, setAdminNewUsername] = useState("");
    const [adminNewPassword, setAdminNewPassword] = useState("");
    const [adminNewRole, setAdminNewRole] = useState<"admin" | "user">("user");
    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [editUserEmail, setEditUserEmail] = useState("");
    const [editUserUsername, setEditUserUsername] = useState("");
    const [editUserPassword, setEditUserPassword] = useState("");

    // Mobile drawer controls
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Shelf states
    const [isShelfOpen, setIsShelfOpen] = useState(false);
    const [shelfItems, setShelfItems] = useState<ShelfItem[]>([]);
    const [shelfLoading, setShelfLoading] = useState(false);
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [shelfNoteTitle, setShelfNoteTitle] = useState("");
    const [shelfNoteText, setShelfNoteText] = useState("");
    const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null);
    const [expandedNoteContent, setExpandedNoteContent] = useState<string | null>(null);
    const [editingNoteTitle, setEditingNoteTitle] = useState("");
    const [editingNoteContent, setEditingNoteContent] = useState("");
    const [noteEditMode, setNoteEditMode] = useState(false);

    // Scrolling reference
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const shelfFileInputRef = useRef<HTMLInputElement>(null);

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
                body: JSON.stringify({
                    email: loginEmail,
                    password: loginPassword,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setAuthError(data.error || "Login credentials failed.");
                return;
            }

            setLoginEmail("");
            setLoginPassword("");
            setToken(data.token);
            showToast("Log in successful. Welcome to LISA!");
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
                if (data.length === 0) {
                    const created = await fetch("/api/chats", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ title: "New Chat", provider: "gemini" }),
                    });
                    if (created.ok) {
                        const newChat = await created.json();
                        setChats([newChat]);
                        setSelectedChatId(newChat.id);
                    }
                } else {
                    setChats(data);
                    if (!selectedChatId) setSelectedChatId(data[0].id);
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
                showToast(
                    `Created new workspace utilizing ${newChatProvider === "gemini" ? "Google Gemini" : "Anthropic Claude"}.`,
                );
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
        if (
            !confirm(
                "Are you sure you want to permanently delete this chat history?",
            )
        )
            return;

        try {
            const res = await fetch(`/api/chats/${chatId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                setChats((prev) => prev.filter((c) => c.id !== chatId));
                if (selectedChatId === chatId) {
                    const remaining = chats.filter((c) => c.id !== chatId);
                    setSelectedChatId(
                        remaining.length > 0 ? remaining[0].id : null,
                    );
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
                    prev.map((c) =>
                        c.id === chatId
                            ? { ...c, title: editingChatTitleValue.trim() }
                            : c,
                    ),
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
            triggerError(
                "Only PDF (.pdf) documents are sponsored for text analysis extraction in this client.",
            );
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
            showToast(
                `Selected "${file.name}" for analysis extraction. Ready to chat!`,
            );
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
            triggerError(
                "Please create a chat session before attempting to send messages.",
            );
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
                ? `[PDF: "${backupFile.name}"]\n\n${backupText || "Please analyze this document."}`
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
                        .concat(data.userMessage, data.assistantMessage),
                );
            } else {
                // Re-inject inputs on error so user doesn't lose text
                setMessageText(backupText);
                setSelectedFile(backupFile);

                // Remove optimistic
                setMessages((prev) =>
                    prev.filter((m) => m.id !== optimisticUserMsg.id),
                );
                triggerError(
                    data.error ||
                        "The model agent was unable to formulate a response.",
                );
            }
        } catch (err: any) {
            setMessageText(backupText);
            setSelectedFile(backupFile);
            setMessages((prev) =>
                prev.filter((m) => m.id !== optimisticUserMsg.id),
            );
            triggerError(
                "Service timeout or network pipeline connection error.",
            );
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
        showToast(
            "Personal API keys successfully stored in this browser session override.",
        );
    };

    // ------------------------------------------
    // ADMINISTRATIVE ACTION DISPATCHERS
    // ------------------------------------------

    const fetchAdminWorkspace = async () => {
        setAdminLoading(true);
        try {
            const [usersRes, statsRes, settingsRes] = await Promise.all([
                fetch("/api/admin/users", {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch("/api/admin/stats", {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch("/api/admin/settings", {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (usersRes.ok && statsRes.ok) {
                setAdminUsers(await usersRes.json());
                setAdminStats(await statsRes.json());
            } else {
                triggerError("Failed to load admin data.");
            }
            if (settingsRes.ok) {
                setAdminSettings(await settingsRes.json());
            }
        } catch {
            triggerError("Could not reach admin endpoints.");
        } finally {
            setAdminLoading(false);
        }
    };

    const handleSaveAdminSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdminSettingsSaving(true);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(adminSettings),
            });
            if (res.ok) {
                showToast("Model settings saved.");
            } else {
                const d = await res.json();
                triggerError(d.error || "Failed to save settings.");
            }
        } catch {
            triggerError("Network error saving settings.");
        } finally {
            setAdminSettingsSaving(false);
        }
    };

    useEffect(() => {
        if (isAdminOpen && user?.role === "admin") {
            fetchAdminWorkspace();
        }
    }, [isAdminOpen]);

    const handleAdminToggleStatus = async (targetId: number) => {
        try {
            const res = await fetch(
                `/api/admin/users/${targetId}/toggle-status`,
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                },
            );
            if (res.ok) {
                setAdminUsers((prev) =>
                    prev.map((u) =>
                        u.id === targetId
                            ? {
                                  ...u,
                                  status:
                                      u.status === "active"
                                          ? "suspended"
                                          : "active",
                              }
                            : u,
                    ),
                );
                showToast("User listing status updated successfully.");
                // Refresh statistics
                const statsRes = await fetch("/api/admin/stats", {
                    headers: { Authorization: `Bearer ${token}` },
                });
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

    const handleAdminChangeRole = async (
        targetId: number,
        currentRole: "admin" | "user",
    ) => {
        const nextRole = currentRole === "admin" ? "user" : "admin";
        if (
            !confirm(
                `Are you certain you wish to adjust this user's administrative level to "${nextRole}"?`,
            )
        )
            return;

        try {
            const res = await fetch(
                `/api/admin/users/${targetId}/change-role`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ role: nextRole }),
                },
            );

            if (res.ok) {
                setAdminUsers((prev) =>
                    prev.map((u) =>
                        u.id === targetId ? { ...u, role: nextRole } : u,
                    ),
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
        if (
            !confirm(
                "Are you sure you want to permanently delete this user account, and all of their historical chats and messages? This operation cannot be undone.",
            )
        )
            return;

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

    const handleAdminEditUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editUserEmail.trim()) return;
        try {
            const res = await fetch(`/api/admin/users/${editingUserId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    email: editUserEmail.trim(),
                    username: editUserUsername.trim() || undefined,
                    password: editUserPassword || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setAdminUsers((prev) =>
                    prev.map((u) =>
                        u.id === editingUserId
                            ? { ...u, email: editUserEmail.trim(), username: editUserUsername.trim() || null }
                            : u,
                    ),
                );
                setEditingUserId(null);
                setEditUserPassword("");
                showToast("User updated.");
            } else {
                triggerError(data.error || "Failed to update user.");
            }
        } catch {
            triggerError("Network error updating user.");
        }
    };

    const handleAdminCreateUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminNewEmail.trim() || !adminNewPassword) {
            triggerError(
                "Please fill out fully the required credentials for the new user profile.",
            );
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
                    username: adminNewUsername.trim() || undefined,
                    password: adminNewPassword,
                    role: adminNewRole,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setAdminNewEmail("");
                setAdminNewUsername("");
                setAdminNewPassword("");
                setAdminNewRole("user");
                setIsAdminCreateOpen(false);
                showToast("New user created successfully in the directory.");
                fetchAdminWorkspace();
            } else {
                triggerError(
                    data.error || "Failed during admin create process.",
                );
            }
        } catch {
            triggerError("Error dispatching directory write request.");
        }
    };

    // ------------------------------------------
    // SHELF HANDLERS
    // ------------------------------------------

    const loadShelf = async () => {
        setShelfLoading(true);
        try {
            const res = await fetch("/api/shelf", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) setShelfItems(await res.json());
        } catch {
            triggerError("Could not load shelf items.");
        } finally {
            setShelfLoading(false);
        }
    };

    useEffect(() => {
        if (isShelfOpen) loadShelf();
    }, [isShelfOpen]);

    const handleShelfFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) {
            triggerError("Max file size is 15 MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = (reader.result as string).split(",")[1];
            try {
                const res = await fetch("/api/shelf", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ name: file.name, item_type: file.type || "application/octet-stream", data: base64, size: file.size }),
                });
                if (res.ok) {
                    const item = await res.json();
                    setShelfItems((prev) => [item, ...prev]);
                    showToast(`"${file.name}" added to shelf.`);
                } else {
                    const d = await res.json();
                    triggerError(d.error || "Failed to upload to shelf.");
                }
            } catch {
                triggerError("Network error uploading to shelf.");
            }
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleShelfNoteCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shelfNoteTitle.trim() || !shelfNoteText.trim()) return;
        try {
            const res = await fetch("/api/shelf", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: shelfNoteTitle.trim(), item_type: "note", data: shelfNoteText.trim(), size: shelfNoteText.length }),
            });
            if (res.ok) {
                const item = await res.json();
                setShelfItems((prev) => [item, ...prev]);
                setShelfNoteTitle("");
                setShelfNoteText("");
                setIsAddingNote(false);
                showToast("Note saved to shelf.");
            } else {
                const d = await res.json();
                triggerError(d.error || "Failed to save note.");
            }
        } catch {
            triggerError("Network error saving note.");
        }
    };

    const handleShelfDownload = async (item: ShelfItem) => {
        try {
            const res = await fetch(`/api/shelf/${item.id}/download`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) { triggerError("Download failed."); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = item.item_type === "note" ? `${item.name}.txt` : item.name;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            triggerError("Network error downloading file.");
        }
    };

    const handleShelfDelete = async (itemId: number) => {
        if (!confirm("Delete this shelf item?")) return;
        try {
            const res = await fetch(`/api/shelf/${itemId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setShelfItems((prev) => prev.filter((i) => i.id !== itemId));
                showToast("Item removed from shelf.");
            } else {
                triggerError("Failed to delete shelf item.");
            }
        } catch {
            triggerError("Network error deleting shelf item.");
        }
    };

    const handleViewNote = async (item: ShelfItem) => {
        if (expandedNoteId === item.id) {
            setExpandedNoteId(null);
            setExpandedNoteContent(null);
            return;
        }
        try {
            const res = await fetch(`/api/shelf/${item.id}/download`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) { triggerError("Could not load note."); return; }
            const text = await res.text();
            setExpandedNoteId(item.id);
            setExpandedNoteContent(text);
            setEditingNoteTitle(item.name);
            setEditingNoteContent(text);
            setNoteEditMode(false);
        } catch {
            triggerError("Network error loading note.");
        }
    };

    const handleSaveNote = async (itemId: number) => {
        try {
            const res = await fetch(`/api/shelf/${itemId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: editingNoteTitle, data: editingNoteContent }),
            });
            if (res.ok) {
                setShelfItems((prev) =>
                    prev.map((i) => i.id === itemId ? { ...i, name: editingNoteTitle, size: editingNoteContent.length } : i)
                );
                setExpandedNoteContent(editingNoteContent);
                showToast("Note saved.");
            } else {
                const d = await res.json();
                triggerError(d.error || "Failed to save note.");
            }
        } catch {
            triggerError("Network error saving note.");
        }
    };

    const handleDownloadMessageFile = async (messageId: number, fileName: string) => {
        try {
            const res = await fetch(`/api/messages/${messageId}/file`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) { triggerError("File not available for download."); return; }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            triggerError("Network error downloading file.");
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
                <div className="absolute bottom-4 right-4 max-w-sm z-50">
                    <AnimatePresence>
                        {authError && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="rounded-lg p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center md:gap-3">
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
                        LISA
                    </h2>
                    <p className="mt-1.5 text-center text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                        A fast, light environment for parsing PDFs and chatting
                        with Gemini 3.5 & Claude 3.5 Sonnet side-by-side.
                    </p>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4 border border-slate-200 shadow-sm rounded-2xl sm:px-10">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                    Username or Email
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoComplete="off"
                                    value={loginEmail}
                                    onChange={(e) =>
                                        setLoginEmail(e.target.value)
                                    }
                                    placeholder="username or email"
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
                                    onChange={(e) =>
                                        setLoginPassword(e.target.value)
                                    }
                                    placeholder="••••••••"
                                    className="w-full rounded-xl border border-slate-250 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full mt-6 bg-slate-900 border border-slate-950 text-white rounded-xl py-3 text-sm font-bold tracking-wide shadow-sm hover:bg-slate-850 active:scale-[0.99] transition-all cursor-pointer flex justify-center items-center gap-1.5">
                                <LogIn className="w-4 h-4" />
                                Access Workspace
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // Token set but user not yet fetched — avoid null crash
    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex gap-1">
                    <span
                        className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"
                        style={{ animationDelay: "0ms" }}
                    />
                    <span
                        className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"
                        style={{ animationDelay: "150ms" }}
                    />
                    <span
                        className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"
                        style={{ animationDelay: "300ms" }}
                    />
                </div>
            </div>
        );
    }

    // CORE APPLICATION INTERFACE SCREEN (LOGGED IN)
    return (
        <div className="h-screen bg-slate-50 flex overflow-hidden font-sans text-slate-900 transition-all duration-300 select-none">
            {/* Alert & Success Toasts */}
            <div className="fixed bottom-4 right-4 max-w-sm z-[9999] pointer-events-none space-y-2">
                <AnimatePresence>
                    {globalError && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="rounded-xl p-4 bg-white border border-rose-250 shadow-lg text-rose-800 text-xs md:text-sm flex items-start gap-3 pointer-events-auto">
                            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                            <div>
                                <h5 className="font-black text-rose-950 uppercase tracking-wider text-[10px] mb-0.5">
                                    Execution Failed
                                </h5>
                                <p className="font-semibold leading-relaxed">
                                    {globalError}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {successToast && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="rounded-xl p-4 bg-white border border-emerald-250 shadow-lg text-emerald-800 text-xs md:text-sm flex items-start gap-3 pointer-events-auto">
                            <Check className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                            <div>
                                <h5 className="font-black text-emerald-950 uppercase tracking-wider text-[10px] mb-0.5">
                                    System Alert
                                </h5>
                                <p className="font-semibold leading-relaxed">
                                    {successToast}
                                </p>
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
                        <span className="font-black text-sm tracking-tight text-slate-900 uppercase">
                            Dual-LLM Suite
                        </span>
                    </div>

                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-black text-slate-400">
                            Authenticated user
                        </span>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-800 truncate max-w-[140px]">
                                {user.email}
                            </span>
                            <span
                                className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded border ${
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
                        className="w-full bg-slate-900 text-white rounded-xl py-3 text-xs font-black tracking-wider uppercase shadow-sm border border-slate-950 hover:bg-slate-850 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />
                        Instigate Chat
                    </button>
                </div>

                {/* Chats Session Ledger */}
                <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
                    <div className="px-2 pb-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        Saved Sessions
                    </div>
                    {chats.length === 0 ? (
                        <div className="p-4 text-center rounded-xl bg-slate-50 border border-slate-100 mx-2 mt-2">
                            <MessageSquare className="w-5 h-5 text-slate-350 mx-auto mb-1.5" />
                            <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                                No chats found
                            </p>
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
                                    }`}>
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        {c.provider === "gemini" ? (
                                            <span
                                                className="w-4 h-4 shrink-0 rounded bg-purple-50 text-[9px] font-black text-purple-600 border border-purple-200 flex items-center justify-center select-none"
                                                title="Google Gemini">
                                                G
                                            </span>
                                        ) : (
                                            <span
                                                className="w-4 h-4 shrink-0 rounded bg-amber-50 text-[9px] font-black text-amber-600 border border-amber-200 flex items-center justify-center select-none"
                                                title="Anthropic Claude">
                                                C
                                            </span>
                                        )}

                                        {isEditing ? (
                                            <input
                                                type="text"
                                                required
                                                autoFocus
                                                value={editingChatTitleValue}
                                                onChange={(e) =>
                                                    setEditingChatTitleValue(
                                                        e.target.value,
                                                    )
                                                }
                                                onBlur={() =>
                                                    handleRenameChatInline(c.id)
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter")
                                                        handleRenameChatInline(
                                                            c.id,
                                                        );
                                                    if (e.key === "Escape")
                                                        setEditingChatId(null);
                                                }}
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                                className="flex-1 outline-none text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-850 font-medium"
                                            />
                                        ) : (
                                            <span className="text-xs truncate font-medium">
                                                {c.title}
                                            </span>
                                        )}
                                    </div>

                                    {!isEditing && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingChatId(c.id);
                                                    setEditingChatTitleValue(
                                                        c.title,
                                                    );
                                                }}
                                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white rounded border border-transparent hover:border-slate-200"
                                                title="Rename Chat">
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) =>
                                                    handleDeleteChat(e, c.id)
                                                }
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded border border-transparent hover:border-slate-200"
                                                title="Delete Chat">
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
                        onClick={() => setIsShelfOpen(true)}
                        className="w-full text-left font-bold text-xs text-slate-600 hover:text-slate-850 p-2.5 rounded-xl hover:bg-slate-150/50 transition-all cursor-pointer flex items-center gap-2">
                        <Archive className="w-4 h-4 text-teal-500" />
                        <span>My Shelf</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsKeysModalOpen(true)}
                        className="w-full text-left font-bold text-xs text-slate-600 hover:text-slate-850 p-2.5 rounded-xl hover:bg-slate-150/50 transition-all cursor-pointer flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-slate-500" />
                            <span>Personal Override Keys</span>
                        </div>
                        {(customGeminiKey || customClaudeKey) && (
                            <span
                                className="w-2 h-2 rounded-full bg-emerald-500"
                                title="Active personal keys"
                            />
                        )}
                    </button>

                    {user.role === "admin" && (
                        <button
                            type="button"
                            onClick={() => setIsAdminOpen(true)}
                            className="w-full text-left font-bold text-xs text-slate-600 hover:text-slate-850 p-2.5 rounded-xl hover:bg-slate-150/50 transition-all cursor-pointer flex items-center gap-2">
                            <Shield className="w-4 h-4 text-indigo-500" />
                            <span>Diagnostic Admin Panel</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left font-bold text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50/50 p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2">
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
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 mr-1">
                            <Menu className="w-5 h-5 text-slate-700" />
                        </button>
                        <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
                        <span className="font-extrabold text-xs tracking-wider uppercase text-slate-900">
                            Dual LLM Chat
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {user.role === "admin" && (
                            <button
                                type="button"
                                onClick={() => setIsAdminOpen(true)}
                                className="p-1.5 rounded-lg border border-slate-150 hover:bg-slate-50 text-indigo-600"
                                title="Admin Panel">
                                <Shield className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="p-1.5 rounded-lg border border-slate-150 hover:bg-slate-50 text-rose-600">
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
                                className="fixed left-0 top-0 bottom-0 max-w-xs w-72 bg-white border-r border-slate-200 flex flex-col z-10">
                                <div className="p-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
                                    <span className="font-extrabold text-xs tracking-widest text-slate-500 uppercase">
                                        Dual Session Desk
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsMobileSidebarOpen(false)
                                        }
                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="p-3 border-b border-slate-100 flex flex-col gap-1.5 m-3.5 bg-slate-50 rounded-xl border border-slate-250">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 leading-none">
                                        Email
                                    </span>
                                    <span className="text-xs font-extrabold text-slate-800 truncate">
                                        {user.email}
                                    </span>
                                </div>

                                <div className="p-4 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsNewChatModalOpen(true);
                                            setIsMobileSidebarOpen(false);
                                        }}
                                        className="w-full bg-slate-900 text-white rounded-xl py-3 text-xs font-black tracking-widest uppercase hover:bg-slate-850 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                        <Plus className="w-4 h-4" />
                                        New Workspace
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto px-2 space-y-1">
                                    <div className="px-2 pb-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Saved Chats
                                    </div>
                                    {chats.length === 0 ? (
                                        <div className="p-4 text-center rounded-xl bg-slate-50 text-slate-400 mx-2">
                                            No chats found
                                        </div>
                                    ) : (
                                        chats.map((c) => {
                                            const isSelected =
                                                c.id === selectedChatId;
                                            return (
                                                <div
                                                    key={c.id}
                                                    onClick={() => {
                                                        setSelectedChatId(c.id);
                                                        setIsMobileSidebarOpen(
                                                            false,
                                                        );
                                                    }}
                                                    className={`flex items-center justify-between rounded-xl p-3 mx-1 cursor-pointer select-none ${
                                                        isSelected
                                                            ? "bg-slate-100 font-bold border-l-4 border-slate-800 text-slate-900 border border-slate-150"
                                                            : "text-slate-600 hover:bg-slate-50 border border-transparent"
                                                    }`}>
                                                    <div className="flex items-center gap-2 truncate flex-1 md:min-w-0">
                                                        {c.provider ===
                                                        "gemini" ? (
                                                            <span className="w-4 h-4 shrink-0 rounded bg-purple-50 text-[9px] font-black text-purple-600 border border-purple-200 flex items-center justify-center">
                                                                G
                                                            </span>
                                                        ) : (
                                                            <span className="w-4 h-4 shrink-0 rounded bg-amber-50 text-[9px] font-black text-amber-600 border border-amber-200 flex items-center justify-center">
                                                                C
                                                            </span>
                                                        )}
                                                        <span className="text-xs truncate font-medium">
                                                            {c.title}
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteChat(
                                                                e,
                                                                c.id,
                                                            );
                                                        }}
                                                        className="p-1 text-slate-400 hover:text-rose-600 ml-2">
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
                                            setIsShelfOpen(true);
                                            setIsMobileSidebarOpen(false);
                                        }}
                                        className="w-full text-left font-bold text-xs text-slate-600 hover:text-slate-800 p-2.5 rounded-xl hover:bg-slate-150/50 flex items-center gap-2">
                                        <Archive className="w-4 h-4 text-teal-500" />
                                        <span>My Shelf</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsKeysModalOpen(true);
                                            setIsMobileSidebarOpen(false);
                                        }}
                                        className="w-full text-left font-bold text-xs text-slate-600 hover:text-slate-800 p-2.5 rounded-xl hover:bg-slate-150/50 flex items-center gap-2">
                                        <Key className="w-4 h-4 text-slate-500" />
                                        <span>Override API Keys</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className="w-full text-left font-bold text-xs text-rose-600 p-2.5 rounded-xl flex items-center gap-2">
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
                                    <h3 className="text-xs font-black text-slate-800 truncate capitalize">
                                        {activeChat.title}
                                    </h3>
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
                                    <h4 className="font-black text-slate-900 text-sm tracking-tight">
                                        Active Room Offline
                                    </h4>
                                    <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                                        Select a historical session from the
                                        mobile drawer or instigate a brand new
                                        workspace matching your targets!
                                    </p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 mb-1 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <h5 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                                        Beginning of Chat
                                    </h5>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                                        Type a message below or attach a PDF
                                        document for analysis context.
                                    </p>
                                </div>
                            ) : (
                                messages.map((m) => {
                                    const isAssistant =
                                        m.sender === "assistant";
                                    return (
                                        <div
                                            key={m.id}
                                            className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
                                            <div
                                                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs border ${
                                                    isAssistant
                                                        ? "bg-slate-50 text-slate-900 border-slate-150 rounded-tl-sm select-text"
                                                        : "bg-indigo-600 text-white border-indigo-700 rounded-tr-sm"
                                                }`}>
                                                {m.file_name && (
                                                    <div
                                                        className={`flex items-center gap-2 p-2 rounded-lg text-xs mb-2 select-none ${
                                                            isAssistant
                                                                ? "bg-slate-100 border border-slate-200 text-slate-700"
                                                                : "bg-indigo-700/50 text-white border border-indigo-500/50"
                                                        }`}>
                                                        <FileText className="w-4 h-4 shrink-0 text-amber-500" />
                                                        <span className="truncate font-semibold max-w-[110px]">
                                                            {m.file_name}
                                                        </span>
                                                        <span className="text-[9px] uppercase font-black tracking-wider shrink-0 bg-slate-900/10 px-1 py-0.5 rounded">
                                                            Analyzed
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadMessageFile(m.id, m.file_name!)}
                                                            className="ml-auto shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
                                                            title="Download file">
                                                            <Download className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                                {isAssistant ? (
                                                    <MarkdownRenderer
                                                        text={m.content}
                                                    />
                                                ) : (
                                                    <p className="text-xs font-semibold whitespace-pre-wrap leading-relaxed select-text">
                                                        {m.content}
                                                    </p>
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
                                            <span
                                                className="w-1.5 h-1.5 rounded-full bg-indigo-55 bg-indigo-600 animate-bounce"
                                                style={{
                                                    animationDelay: "0ms",
                                                }}
                                            />
                                            <span
                                                className="w-1.5 h-1.5 rounded-full bg-indigo-55 bg-indigo-600 animate-bounce"
                                                style={{
                                                    animationDelay: "150ms",
                                                }}
                                            />
                                            <span
                                                className="w-1.5 h-1.5 rounded-full bg-indigo-55 bg-indigo-600 animate-bounce"
                                                style={{
                                                    animationDelay: "300ms",
                                                }}
                                            />
                                        </div>
                                        <span className="text-[10px] uppercase font-black text-slate-400">
                                            Model generating analysis...
                                        </span>
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
                                    <span className="font-extrabold text-sm uppercase tracking-wide text-slate-800">
                                        Drop PDF here
                                    </span>
                                    <span className="text-[10px] text-slate-450 mt-1 uppercase tracking-widest leading-normal">
                                        Release to load text parser
                                    </span>
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
                                            className="bg-white rounded-xl border border-slate-250 p-2.5 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-200 shrink-0">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-slate-800 truncate leading-snug">
                                                        {selectedFile.name}
                                                    </p>
                                                    <p className="text-[9px] font-black tracking-wider text-slate-400 uppercase leading-none mt-1">
                                                        {(
                                                            selectedFile.size /
                                                            1024 /
                                                            1024
                                                        ).toFixed(2)}{" "}
                                                        MB • PDF Text Ready
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedFile(null)
                                                }
                                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <form
                                    onSubmit={handleSendMessage}
                                    className="flex gap-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleNativeFileSelect}
                                        accept="application/pdf"
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        disabled={
                                            !activeChat || isMessageSending
                                        }
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className={`p-3 rounded-xl border border-slate-250 bg-white hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer text-slate-650 transition-all ${
                                            !activeChat || isMessageSending
                                                ? "opacity-50 cursor-not-allowed"
                                                : "active:scale-95"
                                        }`}
                                        title="Upload PDF Document">
                                        <Paperclip className="w-4 h-4" />
                                    </button>

                                    <input
                                        type="text"
                                        required={!selectedFile}
                                        disabled={
                                            !activeChat || isMessageSending
                                        }
                                        value={messageText}
                                        onChange={(e) =>
                                            setMessageText(e.target.value)
                                        }
                                        placeholder={
                                            !activeChat
                                                ? "Open/Create workspace to send context..."
                                                : selectedFile
                                                  ? "Explain analyzer instructions or press send..."
                                                  : "Post prompts to Gemini / Claude..."
                                        }
                                        className={`flex-1 rounded-xl border border-slate-250 bg-white px-4 py-3 text-xs md:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 placeholder-slate-405 transition-all ${
                                            !activeChat || isMessageSending
                                                ? "bg-slate-100 opacity-60 cursor-not-allowed"
                                                : ""
                                        }`}
                                    />

                                    <button
                                        type="submit"
                                        disabled={
                                            !activeChat ||
                                            isMessageSending ||
                                            (!messageText.trim() &&
                                                !selectedFile)
                                        }
                                        className={`bg-slate-900 border border-slate-950 text-white rounded-xl px-4 py-3 flex items-center justify-center cursor-pointer transition-all ${
                                            !activeChat ||
                                            isMessageSending ||
                                            (!messageText.trim() &&
                                                !selectedFile)
                                                ? "bg-slate-350 border-transparent opacity-40 cursor-not-allowed"
                                                : "hover:bg-slate-850 active:scale-95"
                                        }`}>
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
                                <h1 className="text-sm font-black text-slate-850 truncate tracking-tight">
                                    {activeChat.title}
                                </h1>
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
                    className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                    {!activeChat ? (
                        <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto relative select-none">
                            <div className="absolute -top-12 opacity-[12%] py-3 select-none pointer-events-none">
                                <Sparkles className="w-24 h-24 text-slate-600 animate-pulse" />
                            </div>
                            <div className="p-4 bg-white rounded-2xl border border-slate-250 shadow-xs z-10 flex items-center justify-center">
                                <MessageSquare className="w-8 h-8 text-indigo-500 animate-pulse" />
                            </div>
                            <h2 className="mt-4 text-sm font-black uppercase tracking-widest text-slate-900 leading-snug">
                                Choose a Workspace
                            </h2>
                            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                                Dual Chat workspace can parse text from any
                                loaded PDF documents and run inference models.
                                Select an active history card or configure a new
                                room.
                            </p>
                            <div className="mt-5 grid grid-cols-2 gap-3 w-full">
                                <div className="p-4 rounded-xl bg-white border border-slate-250 shadow-xs flex flex-col items-center">
                                    <div className="p-2 rounded bg-purple-50 border border-purple-200 text-purple-600 text-xs font-black mb-1 select-none">
                                        GEMINI
                                    </div>
                                    <span className="text-[10px] text-slate-505 uppercase tracking-wide leading-normal">
                                        Fast response
                                    </span>
                                </div>
                                <div className="p-4 rounded-xl bg-white border border-slate-250 shadow-xs flex flex-col items-center">
                                    <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-600 text-xs font-black mb-1 select-none">
                                        CLAUDE
                                    </div>
                                    <span className="text-[10px] text-slate-505 uppercase tracking-wide leading-normal">
                                        Sonnet 3.5 precision
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto select-none">
                            <div className="p-3 bg-white rounded-2xl border border-slate-250 mb-3 flex items-center justify-center shadow-xs">
                                <FileText className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h4 className="font-extrabold text-sm uppercase tracking-widest text-slate-800">
                                Fresh Dialogue Room
                            </h4>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                Connect your thoughts by posting a prompt. You
                                can also drag and drop raw PDF files right into
                                this viewport to extract their contents
                                automatically!
                            </p>
                        </div>
                    ) : (
                        messages.map((m) => {
                            const isAssistant = m.sender === "assistant";
                            return (
                                <div
                                    key={m.id}
                                    className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
                                    <div
                                        className={`max-w-[75%] rounded-2xl px-5 py-4 shadow-xs border ${
                                            isAssistant
                                                ? "bg-white text-slate-850 border-slate-200 rounded-tl-sm font-normal select-text"
                                                : "bg-indigo-600 text-white border-indigo-700 rounded-tr-sm font-medium"
                                        }`}>
                                        {m.file_name && (
                                            <div
                                                className={`flex items-center gap-2.5 p-2.5 rounded-lg text-xs mb-3 select-none ${
                                                    isAssistant
                                                        ? "bg-slate-50 border border-slate-200 text-slate-700"
                                                        : "bg-indigo-700/50 text-white border border-indigo-500/50"
                                                }`}>
                                                <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                                                <span className="truncate font-semibold max-w-[160px]">
                                                    {m.file_name}
                                                </span>
                                                <span className="text-[9px] uppercase font-black tracking-wider bg-slate-900/15 text-slate-800 px-1.5 py-0.5 rounded">
                                                    Parsed Document context
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadMessageFile(m.id, m.file_name!)}
                                                    className="ml-auto shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
                                                    title="Download file">
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                        {isAssistant ? (
                                            <MarkdownRenderer
                                                text={m.content}
                                            />
                                        ) : (
                                            <p className="text-xs md:text-sm tracking-wide whitespace-pre-wrap leading-relaxed select-text font-normal">
                                                {m.content}
                                            </p>
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
                                    <span
                                        className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce"
                                        style={{ animationDelay: "0ms" }}
                                    />
                                    <span
                                        className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce"
                                        style={{ animationDelay: "150ms" }}
                                    />
                                    <span
                                        className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce"
                                        style={{ animationDelay: "300ms" }}
                                    />
                                </div>
                                <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">
                                    Model processing complex reasoning...
                                </span>
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
                            <span className="font-extrabold text-slate-900 text-base uppercase tracking-wider">
                                Drag Drop PDF document Detected
                            </span>
                            <span className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                                Release your file to extract all pages into
                                plain text and append as context!
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
                                    className="bg-white rounded-xl border border-slate-250 p-3 flex items-center justify-between max-w-md shadow-xs">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-600 shrink-0">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-800 truncate">
                                                {selectedFile.name}
                                            </p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide leading-none mt-1">
                                                {(
                                                    selectedFile.size /
                                                    1024 /
                                                    1024
                                                ).toFixed(2)}{" "}
                                                MB • Plain text cached
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFile(null)}
                                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                                        <X className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form
                            onSubmit={handleSendMessage}
                            className="flex gap-3">
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
                                    !activeChat || isMessageSending
                                        ? "opacity-40 cursor-not-allowed"
                                        : "active:scale-95"
                                }`}
                                title="Attach Document (.pdf only)">
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
                                    !activeChat || isMessageSending
                                        ? "bg-slate-100 opacity-60 cursor-not-allowed"
                                        : ""
                                }`}
                            />

                            <button
                                type="submit"
                                disabled={
                                    !activeChat ||
                                    isMessageSending ||
                                    (!messageText.trim() && !selectedFile)
                                }
                                className={`bg-slate-900 border border-slate-950 text-white rounded-xl px-5 py-3.5 font-bold text-xs tracking-wider uppercase flex items-center justify-center cursor-pointer transition-all ${
                                    !activeChat ||
                                    isMessageSending ||
                                    (!messageText.trim() && !selectedFile)
                                        ? "bg-slate-350 border-transparent opacity-40 cursor-not-allowed"
                                        : "hover:bg-slate-850 active:scale-95 shadow-sm"
                                }`}>
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
                            className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-xl">
                            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
                                <span className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
                                    New Session Suite
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsNewChatModalOpen(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form
                                onSubmit={handleCreateChat}
                                className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                        Workspace Title
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newChatTitle}
                                        onChange={(e) =>
                                            setNewChatTitle(e.target.value)
                                        }
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
                                            onClick={() =>
                                                setNewChatProvider("gemini")
                                            }
                                            className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center ${
                                                newChatProvider === "gemini"
                                                    ? "bg-purple-50 border-purple-300 text-purple-750 font-extrabold shadow-xs"
                                                    : "bg-white border-slate-250 text-slate-500 hover:bg-slate-50"
                                            }`}>
                                            <Sparkles
                                                className={`w-5 h-5 mb-1.5 ${newChatProvider === "gemini" ? "text-purple-600" : "text-slate-400"}`}
                                            />
                                            <span className="text-xs">
                                                Google Gemini
                                            </span>
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mt-1 leading-none">
                                                Flash 3.5
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setNewChatProvider("claude")
                                            }
                                            className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center ${
                                                newChatProvider === "claude"
                                                    ? "bg-amber-50 border-amber-300 text-amber-750 font-extrabold shadow-sm"
                                                    : "bg-white border-slate-250 text-slate-500 hover:bg-slate-50"
                                            }`}>
                                            <Sparkles
                                                className={`w-5 h-5 mb-1.5 ${newChatProvider === "claude" ? "text-amber-600" : "text-slate-400"}`}
                                            />
                                            <span className="text-xs">
                                                Claude 3.5
                                            </span>
                                            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mt-1 leading-none">
                                                Sonnet Precision
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsNewChatModalOpen(false)
                                        }
                                        className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 active:scale-95 cursor-pointer">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-slate-900 border border-slate-950 text-white rounded-lg text-xs font-black tracking-widest uppercase hover:bg-slate-850 active:scale-95 cursor-pointer">
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
                            className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-xl">
                            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
                                <span className="font-extrabold text-sm uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                    <Key className="w-4 h-4 text-slate-505" />
                                    Override API keys
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsKeysModalOpen(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed mb-4">
                                By default, this server loads configured backend
                                credentials from local variables. Fill out
                                override keys here to override using your own
                                keys directly from your browser!
                            </div>

                            <form
                                onSubmit={handleSaveKeysOverride}
                                className="space-y-4">
                                <div>
                                    <label className="block text:[10px] md:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                                        Override Google Gemini Key
                                    </label>
                                    <input
                                        type="password"
                                        value={customGeminiKey}
                                        onChange={(e) =>
                                            setCustomGeminiKey(e.target.value)
                                        }
                                        placeholder={
                                            customGeminiKey
                                                ? "••••••••••••••••"
                                                : "AI Studio environment default keys active..."
                                        }
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
                                        onChange={(e) =>
                                            setCustomClaudeKey(e.target.value)
                                        }
                                        placeholder={
                                            customClaudeKey
                                                ? "••••••••••••••••"
                                                : "Anthropic network defaults active..."
                                        }
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
                                        className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-rose-200 transition-all cursor-pointer">
                                        Clear Overrides
                                    </button>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setIsKeysModalOpen(false)
                                            }
                                            className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer">
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-slate-900 border border-slate-950 text-white rounded-lg text-xs font-black tracking-widest uppercase hover:bg-slate-850 cursor-pointer">
                                            Store Keys
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* SHELF MODAL */}
            <AnimatePresence>
                {isShelfOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                        <motion.div
                            initial={{ scale: 0.97, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.97, opacity: 0 }}
                            className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-hidden border border-slate-200 shadow-xl flex flex-col">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Archive className="w-4 h-4 text-teal-500" />
                                    <span className="font-bold text-sm text-slate-900">My Shelf</span>
                                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider ml-1">Cross-device file storage</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setIsShelfOpen(false); setIsAddingNote(false); }}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {/* Actions */}
                                <div className="flex gap-2">
                                    <input
                                        type="file"
                                        ref={shelfFileInputRef}
                                        onChange={handleShelfFileSelect}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => shelfFileInputRef.current?.click()}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 cursor-pointer transition-all">
                                        <Upload className="w-3.5 h-3.5" />
                                        Upload File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingNote((v) => !v)}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${isAddingNote ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                                        <StickyNote className="w-3.5 h-3.5" />
                                        {isAddingNote ? "Cancel Note" : "Add Note"}
                                    </button>
                                </div>

                                {/* Note form */}
                                <AnimatePresence>
                                    {isAddingNote && (
                                        <motion.form
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            onSubmit={handleShelfNoteCreate}
                                            className="overflow-hidden border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                                            <input
                                                type="text"
                                                required
                                                value={shelfNoteTitle}
                                                onChange={(e) => setShelfNoteTitle(e.target.value)}
                                                placeholder="Note title..."
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
                                            />
                                            <textarea
                                                required
                                                value={shelfNoteText}
                                                onChange={(e) => setShelfNoteText(e.target.value)}
                                                placeholder="Write your note..."
                                                rows={4}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400 resize-none"
                                            />
                                            <div className="flex justify-end">
                                                <button
                                                    type="submit"
                                                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 cursor-pointer">
                                                    Save Note
                                                </button>
                                            </div>
                                        </motion.form>
                                    )}
                                </AnimatePresence>

                                {/* Items list */}
                                {shelfLoading ? (
                                    <div className="text-center py-8 text-sm text-slate-400">Loading shelf…</div>
                                ) : shelfItems.length === 0 ? (
                                    <div className="text-center py-12 flex flex-col items-center gap-2">
                                        <Archive className="w-8 h-8 text-slate-200" />
                                        <p className="text-sm font-semibold text-slate-400">Shelf is empty</p>
                                        <p className="text-xs text-slate-400">Upload files or notes — access them from any device.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {shelfItems.map((item) => (
                                            <div key={item.id} className="rounded-xl border border-slate-100 overflow-hidden">
                                                <div className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-white transition-all">
                                                    <div className={`p-2 rounded-lg shrink-0 ${item.item_type === "note" ? "bg-amber-50 border border-amber-200" : "bg-teal-50 border border-teal-200"}`}>
                                                        {item.item_type === "note"
                                                            ? <StickyNote className="w-4 h-4 text-amber-500" />
                                                            : <FileText className="w-4 h-4 text-teal-500" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">
                                                            {item.item_type === "note" ? "Note" : item.item_type.split("/").pop()?.toUpperCase() ?? "File"}
                                                            {item.size ? ` • ${(item.size / 1024).toFixed(0)} KB` : ""}
                                                            {" • "}{new Date(item.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {item.item_type === "note" && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleViewNote(item)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                                                                title={expandedNoteId === item.id ? "Collapse" : "Read note"}>
                                                                {expandedNoteId === item.id
                                                                    ? <EyeOff className="w-4 h-4" />
                                                                    : <Eye className="w-4 h-4" />}
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleShelfDownload(item)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all cursor-pointer"
                                                            title="Download">
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleShelfDelete(item.id)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                                            title="Delete">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <AnimatePresence>
                                                    {expandedNoteId === item.id && expandedNoteContent !== null && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden border-t border-amber-100">
                                                            <div className="bg-amber-50/40 p-4 flex flex-col gap-3">
                                                                {/* Title row */}
                                                                <div className="flex items-center gap-2">
                                                                    {noteEditMode ? (
                                                                        <input
                                                                            type="text"
                                                                            value={editingNoteTitle}
                                                                            onChange={(e) => setEditingNoteTitle(e.target.value)}
                                                                            className="flex-1 text-base font-bold text-slate-800 bg-transparent border-b border-amber-200 focus:border-amber-400 focus:outline-none pb-1 placeholder-slate-300"
                                                                            placeholder="Note title…"
                                                                        />
                                                                    ) : (
                                                                        <span className="flex-1 text-base font-bold text-slate-800 pb-1 border-b border-amber-100">
                                                                            {editingNoteTitle}
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setNoteEditMode((v) => !v)}
                                                                        className="text-[10px] uppercase font-black tracking-wider px-2 py-1 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all cursor-pointer shrink-0">
                                                                        {noteEditMode ? "Preview" : "Edit"}
                                                                    </button>
                                                                </div>

                                                                {/* Body */}
                                                                {noteEditMode ? (
                                                                    <textarea
                                                                        value={editingNoteContent}
                                                                        onChange={(e) => setEditingNoteContent(e.target.value)}
                                                                        rows={10}
                                                                        className="w-full text-sm text-slate-700 bg-white/70 border border-amber-100 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 leading-relaxed font-mono placeholder-slate-300 select-text"
                                                                        placeholder="Write markdown…"
                                                                    />
                                                                ) : (
                                                                    <div className="min-h-[80px] text-sm text-slate-700 leading-relaxed select-text">
                                                                        <MarkdownRenderer text={editingNoteContent} />
                                                                    </div>
                                                                )}

                                                                {/* Footer */}
                                                                <div className="flex justify-between items-center border-t border-amber-100 pt-2">
                                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                                        {editingNoteContent.length} chars
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSaveNote(item.id)}
                                                                        disabled={
                                                                            editingNoteContent === expandedNoteContent &&
                                                                            editingNoteTitle === item.name
                                                                        }
                                                                        className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">
                                                                        Save
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ADMIN PANEL */}
            <AnimatePresence>
                {isAdminOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                        <motion.div
                            initial={{ scale: 0.97, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.97, opacity: 0 }}
                            className="bg-white rounded-2xl max-w-3xl w-full max-h-[88vh] overflow-hidden border border-slate-200 shadow-xl flex flex-col">
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-indigo-500" />
                                    <span className="font-bold text-sm text-slate-900">
                                        Admin Panel
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAdminOpen(false);
                                        setIsAdminCreateOpen(false);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                                {/* Stats */}
                                {adminStats && (
                                    <div className="grid grid-cols-4 gap-3">
                                        {[
                                            {
                                                label: "Users",
                                                value: adminStats.totalUsers,
                                            },
                                            {
                                                label: "Chats",
                                                value: adminStats.totalChats,
                                            },
                                            {
                                                label: "Messages",
                                                value: adminStats.totalMessages,
                                            },
                                            {
                                                label: "Gemini / Claude",
                                                value: `${adminStats.providers.find((p) => p.provider === "gemini")?.count || 0} / ${adminStats.providers.find((p) => p.provider === "claude")?.count || 0}`,
                                            },
                                        ].map((s) => (
                                            <div
                                                key={s.label}
                                                className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                                                    {s.label}
                                                </p>
                                                <p className="text-xl font-black text-slate-900 mt-0.5">
                                                    {s.value}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Default Models */}
                                <div className="border border-slate-100 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                        Default Models
                                    </p>
                                    <form
                                        onSubmit={handleSaveAdminSettings}
                                        className="grid grid-cols-2 gap-4 items-end">
                                        <div>
                                            <label className="block text-xs text-slate-600 font-medium mb-1">
                                                Gemini
                                            </label>
                                            <select
                                                value={
                                                    adminSettings.gemini_model
                                                }
                                                onChange={(e) =>
                                                    setAdminSettings((s) => ({
                                                        ...s,
                                                        gemini_model:
                                                            e.target.value,
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                                                <option value="gemini-3.1-pro-preview">
                                                    gemini-3.1-pro-preview
                                                </option>
                                                <option value="gemini-3.5-flash">
                                                    gemini-3.5-flash
                                                </option>
                                                <option value="gemini-2.5-flash">
                                                    gemini-2.5-flash
                                                </option>
                                                <option value="gemini-2.5-pro">
                                                    gemini-2.5-pro
                                                </option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-600 font-medium mb-1">
                                                Claude
                                            </label>
                                            <select
                                                value={
                                                    adminSettings.claude_model
                                                }
                                                onChange={(e) =>
                                                    setAdminSettings((s) => ({
                                                        ...s,
                                                        claude_model:
                                                            e.target.value,
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                                                <option value="claude-opus-4-7">
                                                    claude-opus-4-7
                                                </option>
                                                <option value="claude-sonnet-4-6">
                                                    claude-sonnet-4-6
                                                </option>
                                                <option value="claude-haiku-4-5-20251001">
                                                    claude-haiku-4-5
                                                </option>
                                                <option value="claude-3-5-sonnet-latest">
                                                    claude-3-5-sonnet-latest
                                                </option>
                                                <option value="claude-3-opus-latest">
                                                    claude-3-opus-latest
                                                </option>
                                            </select>
                                        </div>
                                        <div className="col-span-2 flex justify-end">
                                            <button
                                                type="submit"
                                                disabled={adminSettingsSaving}
                                                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50">
                                                {adminSettingsSaving
                                                    ? "Saving…"
                                                    : "Save Models"}
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                {/* Users */}
                                <div className="border border-slate-100 rounded-xl overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Users
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={fetchAdminWorkspace}
                                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer">
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setIsAdminCreateOpen(
                                                        (v) => !v,
                                                    )
                                                }
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 cursor-pointer">
                                                {isAdminCreateOpen ? (
                                                    <X className="w-3 h-3" />
                                                ) : (
                                                    <Plus className="w-3 h-3" />
                                                )}
                                                Add User
                                            </button>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {isAdminCreateOpen && (
                                            <motion.div
                                                initial={{
                                                    height: 0,
                                                    opacity: 0,
                                                }}
                                                animate={{
                                                    height: "auto",
                                                    opacity: 1,
                                                }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden border-b border-slate-100">
                                                <form
                                                    onSubmit={
                                                        handleAdminCreateUserSubmit
                                                    }
                                                    className="p-4 grid grid-cols-4 gap-3 items-end bg-slate-50/60">
                                                    <div>
                                                        <label className="block text-xs text-slate-500 font-medium mb-1">
                                                            Email
                                                        </label>
                                                        <input
                                                            type="email"
                                                            required
                                                            value={
                                                                adminNewEmail
                                                            }
                                                            onChange={(e) =>
                                                                setAdminNewEmail(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="user@example.com"
                                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 font-medium mb-1">
                                                            Username
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={adminNewUsername}
                                                            onChange={(e) =>
                                                                setAdminNewUsername(e.target.value)
                                                            }
                                                            placeholder="optional"
                                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 font-medium mb-1">
                                                            Password
                                                        </label>
                                                        <input
                                                            type="password"
                                                            required
                                                            value={
                                                                adminNewPassword
                                                            }
                                                            onChange={(e) =>
                                                                setAdminNewPassword(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="••••••••"
                                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 font-medium mb-1">
                                                            Role
                                                        </label>
                                                        <select
                                                            value={adminNewRole}
                                                            onChange={(e) =>
                                                                setAdminNewRole(
                                                                    e.target
                                                                        .value as any,
                                                                )
                                                            }
                                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none">
                                                            <option value="user">
                                                                User
                                                            </option>
                                                            <option value="admin">
                                                                Admin
                                                            </option>
                                                        </select>
                                                    </div>
                                                    <div className="col-span-4 flex justify-end">
                                                        <button
                                                            type="submit"
                                                            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 cursor-pointer">
                                                            Create User
                                                        </button>
                                                    </div>
                                                </form>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                                    <th className="px-4 py-2.5 font-semibold">
                                                        Email
                                                    </th>
                                                    <th className="px-4 py-2.5 font-semibold">
                                                        Role
                                                    </th>
                                                    <th className="px-4 py-2.5 font-semibold">
                                                        Status
                                                    </th>
                                                    <th className="px-4 py-2.5 font-semibold text-right">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {adminLoading ? (
                                                    <tr>
                                                        <td
                                                            colSpan={4}
                                                            className="text-center py-8 text-sm text-slate-400">
                                                            Loading…
                                                        </td>
                                                    </tr>
                                                ) : adminUsers.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={4}
                                                            className="text-center py-8 text-sm text-slate-400">
                                                            No users found.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    adminUsers.map((u) => {
                                                        const isSelf =
                                                            u.id === user.id;
                                                        return (
                                                            <React.Fragment key={u.id}>
                                                            <tr
                                                                className="hover:bg-slate-50">
                                                                <td className="px-4 py-3 text-slate-800 font-medium">
                                                                    {u.email}
                                                                    {isSelf && (
                                                                        <span className="ml-2 text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded font-bold uppercase">
                                                                            you
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            isSelf
                                                                        }
                                                                        onClick={() =>
                                                                            handleAdminChangeRole(
                                                                                u.id,
                                                                                u.role,
                                                                            )
                                                                        }
                                                                        className={`text-xs px-2 py-0.5 rounded border font-semibold transition-all ${isSelf ? "cursor-default" : "cursor-pointer hover:opacity-75"} ${u.role === "admin" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                                                                        {u.role}
                                                                    </button>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            isSelf
                                                                        }
                                                                        onClick={() =>
                                                                            handleAdminToggleStatus(
                                                                                u.id,
                                                                            )
                                                                        }
                                                                        className={`text-xs px-2 py-0.5 rounded border font-semibold transition-all ${isSelf ? "cursor-default" : "cursor-pointer hover:opacity-75"} ${u.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                                                                        {
                                                                            u.status
                                                                        }
                                                                    </button>
                                                                </td>
                                                                <td className="px-4 py-3 text-right flex justify-end gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (editingUserId === u.id) {
                                                                                setEditingUserId(null);
                                                                            } else {
                                                                                setEditingUserId(u.id);
                                                                                setEditUserEmail(u.email);
                                                                                setEditUserUsername(u.username || "");
                                                                                setEditUserPassword("");
                                                                            }
                                                                        }}
                                                                        className="p-1.5 rounded-lg transition-all text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer">
                                                                        <Edit2 className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isSelf}
                                                                        onClick={() => handleAdminDeleteUser(u.id)}
                                                                        className={`p-1.5 rounded-lg transition-all ${isSelf ? "text-slate-200 cursor-not-allowed" : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"}`}>
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            {editingUserId === u.id && (
                                                                <tr className="bg-indigo-50/40">
                                                                    <td colSpan={4} className="px-4 py-3">
                                                                        <form onSubmit={handleAdminEditUserSubmit} className="grid grid-cols-4 gap-3 items-end">
                                                                            <div>
                                                                                <label className="block text-xs text-slate-500 font-medium mb-1">Email</label>
                                                                                <input
                                                                                    type="email"
                                                                                    required
                                                                                    value={editUserEmail}
                                                                                    onChange={(e) => setEditUserEmail(e.target.value)}
                                                                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-xs text-slate-500 font-medium mb-1">Username</label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={editUserUsername}
                                                                                    onChange={(e) => setEditUserUsername(e.target.value)}
                                                                                    placeholder="optional"
                                                                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-xs text-slate-500 font-medium mb-1">New Password</label>
                                                                                <input
                                                                                    type="password"
                                                                                    value={editUserPassword}
                                                                                    onChange={(e) => setEditUserPassword(e.target.value)}
                                                                                    placeholder="leave blank to keep"
                                                                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                                                                />
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <button type="submit" className="flex-1 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 cursor-pointer">Save</button>
                                                                                <button type="button" onClick={() => setEditingUserId(null)} className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer">Cancel</button>
                                                                            </div>
                                                                        </form>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            </React.Fragment>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
