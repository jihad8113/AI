import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
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

// 8. Static PA (STP.txt) Management in src and root directories
const ROOT_STP_FILE_PATH = path.join(process.cwd(), 'STP.txt');
const SRC_STP_FILE_PATH = path.join(process.cwd(), 'src', 'STP.txt');
const PYTHON_STP_SCRIPT = path.join(process.cwd(), 'stp_manager.py');
const DEFAULT_STATIC_PASSWORD = 'S-and-T@7-2026';

function isValidEmail(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function readCurrentStaticPassword(): string {
  try {
    for (const filePath of [SRC_STP_FILE_PATH, ROOT_STP_FILE_PATH]) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          if (!isValidEmail(lastLine)) {
            return lastLine;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading current static password:', err);
  }
  return DEFAULT_STATIC_PASSWORD;
}

function writeStpFiles(content: string) {
  const targetPaths = [
    SRC_STP_FILE_PATH,
    ROOT_STP_FILE_PATH,
    path.join(process.cwd(), 'public', 'STP.txt'),
    path.join(process.cwd(), 'dist', 'STP.txt')
  ];

  for (const filePath of targetPaths) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (e) {
      console.warn(`Notice writing to ${filePath}:`, e);
    }
  }
}

// Execute python stp_manager.py directly
function runPythonStpSync(emails: string[], password: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    if (!fs.existsSync(PYTHON_STP_SCRIPT)) {
      return resolve({ ok: false, output: 'stp_manager.py not found' });
    }

    const emailsArg = emails.length > 0 ? emails.join(',') : '';
    const passArg = password || DEFAULT_STATIC_PASSWORD;
    const cmd = `python3 "${PYTHON_STP_SCRIPT}" write --emails "${emailsArg}" --password "${passArg}"`;

    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        console.warn('Python sync execution notice:', stderr || error.message);
        return resolve({ ok: false, output: stderr || error.message });
      }
      return resolve({ ok: true, output: stdout });
    });
  });
}

// Direct raw text endpoints so the file can be inspected in the browser
app.get(['/STP.txt', '/src/STP.txt', '/api/static-pa/raw'], (req: Request, res: Response) => {
  try {
    let content = '';
    if (fs.existsSync(SRC_STP_FILE_PATH)) {
      content = fs.readFileSync(SRC_STP_FILE_PATH, 'utf-8');
    } else if (fs.existsSync(ROOT_STP_FILE_PATH)) {
      content = fs.readFileSync(ROOT_STP_FILE_PATH, 'utf-8');
    } else {
      content = `alex.morgan@outlook.com\nserver.alerts@hotmail.com\n${DEFAULT_STATIC_PASSWORD}\n`;
      writeStpFiles(content);
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.send(content);
  } catch (err: any) {
    return res.status(500).send(`Error reading STP.txt: ${err.message}`);
  }
});

app.get('/api/static-pa', (req: Request, res: Response) => {
  try {
    let content = '';
    if (fs.existsSync(SRC_STP_FILE_PATH)) {
      content = fs.readFileSync(SRC_STP_FILE_PATH, 'utf-8');
    } else if (fs.existsSync(ROOT_STP_FILE_PATH)) {
      content = fs.readFileSync(ROOT_STP_FILE_PATH, 'utf-8');
    } else {
      content = `alex.morgan@outlook.com\nserver.alerts@hotmail.com\n${DEFAULT_STATIC_PASSWORD}\n`;
      writeStpFiles(content);
    }

    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let password = DEFAULT_STATIC_PASSWORD;
    const emails: string[] = [];

    if (lines.length === 1) {
      if (isValidEmail(lines[0])) {
        emails.push(lines[0]);
        password = DEFAULT_STATIC_PASSWORD;
      } else {
        password = lines[0];
      }
    } else if (lines.length > 1) {
      const lastLine = lines[lines.length - 1];
      if (!isValidEmail(lastLine)) {
        password = lastLine;
        emails.push(...lines.slice(0, lines.length - 1).filter(l => isValidEmail(l) || (l.includes('@') && l.includes('.'))));
      } else {
        emails.push(...lines.filter(l => isValidEmail(l) || (l.includes('@') && l.includes('.'))));
        password = DEFAULT_STATIC_PASSWORD;
      }
    }

    return res.json({
      ok: true,
      filePath: 'src/STP.txt & STP.txt',
      content,
      password,
      emails,
      defaultPassword: DEFAULT_STATIC_PASSWORD
    });
  } catch (err: any) {
    console.error('Error reading STP.txt:', err);
    return res.status(500).json({
      error: 'Failed to read STP.txt',
      message: err.message
    });
  }
});

app.post('/api/static-pa', async (req: Request, res: Response) => {
  try {
    const { content, password, emails } = req.body;
    let finalContent = '';
    let finalEmails: string[] = [];
    let finalPass = password && typeof password === 'string' && password.trim().length > 0
      ? password.trim()
      : readCurrentStaticPassword();

    if (content && typeof content === 'string') {
      finalContent = content.trim() + '\n';
      const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        const last = lines[lines.length - 1];
        if (!isValidEmail(last)) {
          finalPass = last;
          finalEmails = lines.slice(0, lines.length - 1).filter(e => isValidEmail(e) || (e.includes('@') && e.includes('.')));
        } else {
          finalEmails = lines.filter(e => isValidEmail(e) || (e.includes('@') && e.includes('.')));
        }
      }
    } else if (Array.isArray(emails)) {
      finalEmails = emails.map(e => String(e).trim()).filter(e => isValidEmail(e) || (e.includes('@') && e.includes('.')));
      if (finalEmails.length > 0) {
        finalContent = `${finalEmails.join('\n')}\n${finalPass}\n`;
      } else {
        finalContent = `${finalPass}\n`;
      }
    } else {
      return res.status(400).json({
        error: 'Invalid payload. Provide content or { emails, password }.'
      });
    }

    // Direct write to ensure instant availability
    writeStpFiles(finalContent);

    // Also run python script in background/async to ensure python compatibility
    const pyResult = await runPythonStpSync(finalEmails, finalPass);

    return res.json({
      ok: true,
      message: 'Successfully updated STP.txt using Python & File Sync',
      filePath: 'src/STP.txt & STP.txt',
      content: finalContent,
      pythonSynced: pyResult.ok,
      pythonOutput: pyResult.output
    });
  } catch (err: any) {
    console.error('Error saving STP.txt:', err);
    return res.status(500).json({
      error: 'Failed to write STP.txt',
      message: err.message
    });
  }
});

// Run raw Python STP commands
app.post('/api/python/stp', (req: Request, res: Response) => {
  const { command, args } = req.body;
  const validCommands = ['read', 'write', 'add', 'remove', 'set-pass'];
  const cmdType = validCommands.includes(command) ? command : 'read';

  let cliArgs = cmdType;
  if (cmdType === 'add' || cmdType === 'remove' || cmdType === 'set-pass') {
    if (args) cliArgs += ` "${args}"`;
  } else if (cmdType === 'write' && args) {
    cliArgs += ` ${args}`;
  }

  const fullCmd = `python3 "${PYTHON_STP_SCRIPT}" ${cliArgs}`;
  exec(fullCmd, { timeout: 6000 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ ok: false, error: stderr || error.message });
    }
    try {
      const parsed = JSON.parse(stdout);
      return res.json(parsed);
    } catch {
      return res.json({ ok: true, output: stdout });
    }
  });
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
