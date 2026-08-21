import { MailAccount, EmailMessage, TelegramSettings, SyncLog } from '../types';

export async function refreshMicrosoftToken(
  clientId: string,
  refreshToken: string,
  clientSecret?: string
): Promise<{ accessToken?: string; newRefreshToken?: string; error?: string }> {
  try {
    const res = await fetch('/api/microsoft/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        refresh_token: refreshToken,
        client_secret: clientSecret
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        error: data.error_description || data.error || 'Failed to exchange refresh token'
      };
    }

    return {
      accessToken: data.access_token,
      newRefreshToken: data.new_refresh_token
    };
  } catch (err: any) {
    return { error: err.message || 'Network error connecting to token endpoint' };
  }
}

export async function fetchInboxMessages(
  account: MailAccount,
  options: { limit?: number; showOld?: boolean; search?: string } = {}
): Promise<{ messages?: EmailMessage[]; error?: string }> {
  try {
    const res = await fetch('/api/microsoft/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: account.clientId,
        refresh_token: account.refreshToken,
        access_token: account.accessToken,
        limit: options.limit || 20,
        show_old: options.showOld || false,
        search: options.search || ''
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || data.details?.error_description || 'Failed to fetch inbox' };
    }

    const formattedMessages: EmailMessage[] = (data.messages || []).map((m: any) => ({
      id: m.id,
      subject: m.subject || '(No Subject)',
      from: m.from || { emailAddress: { name: 'Unknown', address: 'Unknown' } },
      receivedDateTime: m.receivedDateTime,
      bodyPreview: m.bodyPreview || '',
      isRead: m.isRead ?? false,
      importance: m.importance || 'normal',
      hasAttachments: m.hasAttachments ?? false,
      webLink: m.webLink,
      accountEmail: account.email
    }));

    return { messages: formattedMessages };
  } catch (err: any) {
    return { error: err.message || 'Network error fetching inbox' };
  }
}

export async function testTelegramToken(token: string): Promise<{ ok: boolean; bot?: any; error?: string }> {
  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim() })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Invalid Bot Token' };
    }
    return { ok: true, bot: data.bot };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function sendTelegramAlert(
  telegramSettings: TelegramSettings,
  targetChatId: string | number,
  text: string,
  replyMarkup?: any
): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = telegramSettings.botToken;
    const chatId = targetChatId || telegramSettings.defaultChatId;

    if (!token) {
      return { ok: false, error: 'Telegram Bot Token is not configured' };
    }
    if (!chatId) {
      return { ok: false, error: 'No Chat ID provided' };
    }

    const res = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Failed to dispatch Telegram message' };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function summarizeEmailAi(message: EmailMessage): Promise<{ ok: boolean; analysis?: any; error?: string }> {
  try {
    const senderName = message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'Unknown';
    const res = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: message.subject,
        sender: senderName,
        bodyPreview: message.bodyPreview,
        fullBody: message.body?.content
      })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'AI summary failed' };
    }
    return { ok: true, analysis: data.analysis };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
