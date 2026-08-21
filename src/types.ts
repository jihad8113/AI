export interface EmailSender {
  emailAddress?: {
    name?: string;
    address?: string;
  };
  name?: string;
  address?: string;
}

export interface AiAnalysis {
  summary: string;
  category: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  keyPoints?: string[];
  actionRequired?: boolean;
  actionItem?: string | null;
  suggestedReply?: string;
  extractedCodes?: string[];
}

export interface EmailMessage {
  id: string;
  subject: string;
  from: EmailSender;
  receivedDateTime: string;
  bodyPreview: string;
  body?: {
    contentType?: 'text' | 'html';
    content?: string;
  };
  isRead?: boolean;
  importance?: 'low' | 'normal' | 'high';
  hasAttachments?: boolean;
  webLink?: string;
  accountEmail: string;
  isStarred?: boolean;
  aiAnalysis?: AiAnalysis;
  forwardedToTelegram?: boolean;
}

export interface MailAccount {
  id: string;
  email: string;
  password?: string;
  refreshToken: string;
  clientId: string;
  clientSecret?: string;
  userId: string; // Telegram user/chat id
  status: 'connected' | 'error' | 'expired_token' | 'idle' | 'fetching';
  lastChecked?: string | null;
  lastError?: string;
  messages: EmailMessage[];
  unreadCount?: number;
  label?: string;
  color?: string;
  accessToken?: string;
  tokenExpiresAt?: number;
}

export interface TelegramSettings {
  botToken: string;
  defaultChatId: string;
  autoForward: boolean;
  forwardUrgentOnly: boolean;
  sendOtpAlertsOnly: boolean;
  includeAiSummary: boolean;
  botUsername?: string;
  botStatus: 'not_configured' | 'valid' | 'invalid' | 'testing';
  lastTestResult?: string;
}

export interface SyncSettings {
  autoSyncEnabled: boolean;
  intervalSeconds: number;
  soundEnabled: boolean;
  toastEnabled: boolean;
  fetchLimit: number;
  showOldByDefault: boolean;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'telegram' | 'ai';
  accountEmail?: string;
  message: string;
  details?: string;
}

export interface WinToast {
  id: string;
  title: string;
  sender?: string;
  preview: string;
  accountEmail?: string;
  timestamp: string;
  type: 'email' | 'telegram' | 'system' | 'error';
  messageId?: string;
}

export type ViewTab = 'inbox' | 'accounts' | 'sync' | 'telegram' | 'ai' | 'scripts' | 'settings';
