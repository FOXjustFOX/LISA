export interface User {
  id: number;
  email: string;
  username?: string | null;
  role: "admin" | "user";
  status: "active" | "suspended";
  created_at?: string;
}

export interface Chat {
  id: string;
  user_id: number;
  title: string;
  provider: "gemini" | "claude";
  created_at: string;
}

export interface Message {
  id: number;
  chat_id: string;
  sender: "user" | "assistant";
  content: string;
  file_name?: string | null;
  file_type?: string | null;
  created_at: string;
}

export interface AdminSettings {
  gemini_model: string;
  claude_model: string;
}

export interface AdminStats {
  totalUsers: number;
  totalChats: number;
  totalMessages: number;
  providers: { provider: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
}

export interface ShelfItem {
  id: number;
  user_id: number;
  name: string;
  item_type: string;
  size: number | null;
  created_at: string;
}
