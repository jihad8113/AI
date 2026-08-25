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

export async function fetchStaticPaData(): Promise<{
  ok: boolean;
  content?: string;
  password?: string;
  emails?: string[];
  filePath?: string;
  error?: string;
}> {
  const endpoints = ['/api/static-pa', '/api/stp', '/api/static_pa', '/STP.txt'];
  let lastError = 'Failed to fetch Static PA';

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (text) {
          try {
            const data = JSON.parse(text);
            if (data && (data.ok !== false)) {
              return {
                ok: true,
                content: data.content,
                password: data.password,
                emails: data.emails,
                filePath: data.filePath
              };
            }
          } catch {
            // If raw text returned (e.g. from /STP.txt)
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            let password = 'S-and-T@7-2026';
            const emails: string[] = [];
            if (lines.length > 0) {
              const last = lines[lines.length - 1];
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(last)) {
                password = last;
                emails.push(...lines.slice(0, lines.length - 1).filter(l => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l)));
              } else {
                emails.push(...lines.filter(l => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l)));
              }
            }
            return {
              ok: true,
              content: text,
              password,
              emails,
              filePath: 'src/STP.txt'
            };
          }
        }
      } else {
        lastError = `Status ${res.status} on ${ep}`;
      }
    } catch (err: any) {
      lastError = err.message || 'Network error';
    }
  }

  return { ok: false, error: lastError };
}

export async function saveStaticPaData(payload: {
  content?: string;
  password?: string;
  emails?: string[];
}): Promise<{ ok: boolean; message?: string; content?: string; error?: string; pythonSynced?: boolean; pythonOutput?: string }> {
  const endpoints = ['/api/static-pa', '/api/stp', '/api/static_pa', '/api/static-pa/save', '/api/stp/save'];
  let lastError = 'Failed to save Static PA';

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { ok: res.ok, message: text };
        }
      }
      if (res.ok && (data.ok ?? true)) {
        return {
          ok: true,
          message: data.message || 'Saved successfully',
          content: data.content,
          pythonSynced: data.pythonSynced ?? true,
          pythonOutput: data.pythonOutput
        };
      } else {
        lastError = data.error || data.message || `Server returned status ${res.status}`;
      }
    } catch (err: any) {
      lastError = err.message || 'Network error saving Static PA';
    }
  }

  return { ok: false, error: lastError };
}

export async function syncFleetEmailsToStaticPa(
  emails: string[],
  password?: string
): Promise<{ ok: boolean; error?: string; pythonSynced?: boolean }> {
  try {
    const result = await saveStaticPaData({ emails, password });
    if (!result.ok) {
      console.warn('Auto-sync fleet emails to STP.txt warning:', result.error);
    }
    return { ok: result.ok, error: result.error, pythonSynced: result.pythonSynced };
  } catch (err: any) {
    console.error('Auto-sync fleet emails to STP.txt error:', err);
    return { ok: false, error: err.message || 'Auto-sync failed' };
  }
}

export async function executePythonStpCommand(
  command: 'read' | 'write' | 'add' | 'remove' | 'set-pass',
  args?: string
): Promise<{ ok: boolean; output?: string; error?: string; content?: string; emails?: string[]; password?: string }> {
  try {
    const res = await fetch('/api/python/stp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args })
    });
    const text = await res.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: res.ok, output: text };
      }
    }
    if (!res.ok || (data && data.ok === false)) {
      return { ok: false, error: data.error || data.message || `Server error ${res.status}` };
    }
    return data;
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to execute Python STP command' };
  }
}

