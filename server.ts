import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy init Gemini AI
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

// 1. Health check & environment status
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
    defaultChatId: process.env.TELEGRAM_CHAT_ID || ''
  });
});

// 2. Microsoft Graph OAuth Token Exchange (Refresh Token -> Access Token)
app.post('/api/microsoft/token', async (req: Request, res: Response) => {
  try {
    const { client_id, refresh_token, client_secret } = req.body;

    if (!client_id || !refresh_token) {
      return res.status(400).json({
        error: 'Missing client_id or refresh_token',
        details: 'Both client_id and refresh_token are required to acquire an access token.'
      });
    }

    const tokenUrls = [
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    ];

    let lastError: any = null;

    for (const tokenUrl of tokenUrls) {
      try {
        const params = new URLSearchParams();
        params.append('client_id', client_id.trim());
        params.append('refresh_token', refresh_token.trim());
        params.append('grant_type', 'refresh_token');
        params.append('scope', 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite offline_access');
        if (client_secret) {
          params.append('client_secret', client_secret.trim());
        }

        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: params.toString()
        });

        const data: any = await response.json();

        if (response.ok && data.access_token) {
          return res.json({
            access_token: data.access_token,
            expires_in: data.expires_in,
            token_type: data.token_type,
            new_refresh_token: data.refresh_token || refresh_token
          });
        } else {
          lastError = data;
        }
      } catch (err: any) {
        lastError = { error: err.message };
      }
    }

    return res.status(400).json({
      error: lastError?.error || 'Token acquisition failed',
      error_description: lastError?.error_description || 'Invalid refresh token or client ID.',
      raw: lastError
    });
  } catch (error: any) {
    console.error('Error refreshing Microsoft token:', error);
    return res.status(500).json({
      error: 'Internal server error while connecting to Microsoft OAuth',
      message: error.message
    });
  }
});

// 3. Microsoft Graph Fetch Inbox Messages
app.post('/api/microsoft/inbox', async (req: Request, res: Response) => {
  try {
    let { access_token, client_id, refresh_token, limit = 20, show_old = false, search = '' } = req.body;

    // Auto-acquire token if refresh token provided and access token is missing
    if (!access_token && client_id && refresh_token) {
      const tokenUrls = [
        'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
        'https://login.microsoftonline.com/common/oauth2/v2.0/token'
      ];

      for (const tUrl of tokenUrls) {
        try {
          const tokenRes = await fetch(tUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: client_id.trim(),
              refresh_token: refresh_token.trim(),
              grant_type: 'refresh_token',
              scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite offline_access'
            }).toString()
          });
          if (tokenRes.ok) {
            const tokenData: any = await tokenRes.json();
            access_token = tokenData.access_token;
            break;
          }
        } catch (e) {}
      }
    }

    if (!access_token) {
      return res.status(400).json({ error: 'Access token or valid refresh credentials required' });
    }

    const topCount = show_old ? 100 : Math.min(Number(limit) || 20, 100);
    let graphUrl = `https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages?$top=${topCount}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,importance,hasAttachments,webLink`;

    if (search && search.trim()) {
      graphUrl += `&$search="${encodeURIComponent(search.trim())}"`;
    }

    const graphRes = await fetch(graphUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'outlook.body-content-type="text"'
      }
    });

    const graphData: any = await graphRes.json();

    if (!graphRes.ok) {
      return res.status(graphRes.status).json({
        error: graphData.error?.message || 'Microsoft Graph API error',
        raw: graphData
      });
    }

    return res.json({
      messages: graphData.value || [],
      count: graphData.value ? graphData.value.length : 0,
      nextLink: graphData['@odata.nextLink'] || null
    });
  } catch (error: any) {
    console.error('Error fetching Graph inbox:', error);
    return res.status(500).json({
      error: 'Failed to fetch messages from Microsoft Graph',
      message: error.message
    });
  }
});

// 4. Microsoft Graph Single Message Detail
app.post('/api/microsoft/message', async (req: Request, res: Response) => {
  try {
    const { access_token, message_id } = req.body;
    if (!access_token || !message_id) {
      return res.status(400).json({ error: 'access_token and message_id are required' });
    }

    const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(message_id)}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,isRead,importance,hasAttachments,webLink`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data: any = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Failed to fetch message' });
    }

    return res.json({ message: data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. Telegram Bot API: Test Token & getMe
app.post('/api/telegram/test', async (req: Request, res: Response) => {
  try {
    const token = req.body.token || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return res.status(400).json({ error: 'Telegram Bot token is required' });
    }

    const response = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
    const data: any = await response.json();

    if (!data.ok) {
      return res.status(400).json({
        error: data.description || 'Invalid Telegram Bot Token',
        telegramResponse: data
      });
    }

    return res.json({
      ok: true,
      bot: data.result
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to contact Telegram API',
      message: error.message
    });
  }
});

// 6. Telegram Bot API: Send Message with optional inline buttons
app.post('/api/telegram/send', async (req: Request, res: Response) => {
  try {
    const { token: customToken, chat_id, text, parse_mode = 'HTML', reply_markup } = req.body;
    const token = (customToken || process.env.TELEGRAM_BOT_TOKEN || '').trim();

    if (!token) {
      return res.status(400).json({ error: 'Telegram Bot Token is required' });
    }
    if (!chat_id) {
      return res.status(400).json({ error: 'Target Chat ID or User ID is required' });
    }
    if (!text) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const payload: any = {
      chat_id,
      text,
      parse_mode,
      disable_web_page_preview: true
    };

    if (reply_markup) {
      payload.reply_markup = reply_markup;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data: any = await response.json();

    if (!data.ok) {
      return res.status(400).json({
        error: data.description || 'Telegram API returned error',
        details: data
      });
    }

    return res.json({
      ok: true,
      message_id: data.result?.message_id,
      result: data.result
    });
  } catch (error: any) {
    console.error('Error sending telegram message:', error);
    return res.status(500).json({
      error: 'Failed to send Telegram message',
      message: error.message
    });
  }
});

// 7. Gemini AI: Smart Email Summarizer & Action Item Extractor
app.post('/api/ai/summarize', async (req: Request, res: Response) => {
  try {
    const { subject, sender, bodyPreview, fullBody } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(400).json({
        error: 'Gemini API key is not configured. Please add GEMINI_API_KEY in Settings.'
      });
    }

    const contentToAnalyze = fullBody || bodyPreview || subject || '';
    const prompt = `You are an intelligent email analyzer integrated into a Windows 11 Outlook & Telegram notification app.
Analyze the following email and return a strictly structured JSON response.

Email Subject: ${subject || 'No Subject'}
Sender: ${sender || 'Unknown'}
Content:
${contentToAnalyze.slice(0, 4000)}

Respond with a valid JSON object matching this schema:
{
  "summary": "1-2 sentence executive summary of the email",
  "category": "Verification Code / Security | Invoice / Financial | Newsletter / Promo | Personal / Work | Notification | Urgent Action Required",
  "urgency": "low | medium | high | critical",
  "keyPoints": ["bullet 1", "bullet 2"],
  "actionRequired": boolean,
  "actionItem": "Short action required or null",
  "suggestedReply": "A concise, professional 2-3 sentence draft response, or empty string if no response is needed",
  "extractedCodes": ["any verification OTPs, security PINs, tracking numbers or confirmation codes found"]
}
`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = result.text || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { summary: responseText, urgency: 'medium', category: 'General' };
    }

    return res.json({
      ok: true,
      analysis: parsed
    });
  } catch (error: any) {
    console.error('Error in AI summarize:', error);
    return res.status(500).json({
      error: 'AI analysis failed',
      message: error.message
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Windows 11 Mail & Telegram Server running at http://localhost:${PORT}`);
  });
}

startServer();
