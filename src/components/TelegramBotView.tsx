import React, { useState } from 'react';
import {
  Bot,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Shield,
  Smartphone,
  Copy,
  Sparkles,
  Radio,
  Sliders,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { TelegramSettings, MailAccount } from '../types';
import { testTelegramToken, sendTelegramAlert } from '../utils/apiService';
import { playTelegramPing, playSoftClick } from '../utils/audio';

interface TelegramBotViewProps {
  telegramSettings: TelegramSettings;
  setTelegramSettings: React.Dispatch<React.SetStateAction<TelegramSettings>>;
  accounts: MailAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<MailAccount[]>>;
  darkMode: boolean;
  addToast: (toast: any) => void;
  addLog: (type: any, message: string, details?: string, accountEmail?: string) => void;
}

interface SimulatedMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  buttons?: { text: string; callback: string }[][];
}

export const TelegramBotView: React.FC<TelegramBotViewProps> = ({
  telegramSettings,
  setTelegramSettings,
  accounts,
  setAccounts,
  darkMode,
  addToast,
  addLog
}) => {
  const [testingToken, setTestingToken] = useState(false);
  const [testMessageText, setTestMessageText] = useState('🔔 Test alert from Windows 11 WinMail Controller!');
  const [sendingTest, setSendingTest] = useState(false);

  // Simulator State
  const [simInput, setSimInput] = useState('');
  const [simMessages, setSimMessages] = useState<SimulatedMessage[]>([
    {
      id: 'sim_1',
      sender: 'bot',
      text: '👋 <b>Welcome to WinMail Alert Bot!</b>\n\nSend: <code>mail|password|refresh_token|clientid</code>\nor use the keyboard buttons below to manage inboxes:',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      buttons: [
        [
          { text: '📧 Mail Accounts', callback: 'cmd_mail' },
          { text: '🔄 Check All Inboxes', callback: 'cmd_check' }
        ],
        [
          { text: '➕ Add Account', callback: 'cmd_add' },
          { text: '🗑️ Remove Account', callback: 'cmd_remove' }
        ]
      ]
    }
  ]);

  const handleTestBotConnection = async () => {
    if (!telegramSettings.botToken.trim()) {
      alert('Please enter a Telegram Bot Token first.');
      return;
    }

    setTestingToken(true);
    const res = await testTelegramToken(telegramSettings.botToken);
    setTestingToken(false);

    if (res.ok && res.bot) {
      setTelegramSettings((prev) => ({
        ...prev,
        botStatus: 'valid',
        botUsername: res.bot.username,
        lastTestResult: `Connected to @${res.bot.username} (ID: ${res.bot.id})`
      }));
      playTelegramPing();
      addToast({
        id: Date.now().toString(),
        title: 'Telegram Bot Connected',
        preview: `Authenticated successfully with @${res.bot.username}`,
        type: 'telegram'
      });
      addLog('telegram', `Verified Telegram bot token: @${res.bot.username}`);
    } else {
      setTelegramSettings((prev) => ({
        ...prev,
        botStatus: 'invalid',
        lastTestResult: res.error || 'Token validation failed'
      }));
      addToast({
        id: Date.now().toString(),
        title: 'Telegram Connection Failed',
        preview: res.error || 'Invalid Bot Token. Check @BotFather.',
        type: 'error'
      });
      addLog('error', `Telegram bot token test failed: ${res.error}`);
    }
  };

  const handleSendTestMessage = async () => {
    if (!telegramSettings.botToken || !telegramSettings.defaultChatId) {
      alert('Both Telegram Bot Token and Default Chat ID are required.');
      return;
    }

    setSendingTest(true);
    const res = await sendTelegramAlert(
      telegramSettings,
      telegramSettings.defaultChatId,
      `<b>⚡ TEST DISPATCH</b>\n\n${testMessageText}\n\n<i>Dispatched from Windows 11 WinMail App</i>`,
      {
        inline_keyboard: [
          [{ text: '🖥️ Open WinMail Controller', url: 'https://ai.studio/build' }]
        ]
      }
    );
    setSendingTest(false);

    if (res.ok) {
      playTelegramPing();
      addToast({
        id: Date.now().toString(),
        title: 'Telegram Test Dispatched',
        preview: `Sent message to Chat ID ${telegramSettings.defaultChatId}`,
        type: 'telegram'
      });
      addLog('telegram', `Dispatched test message to chat ${telegramSettings.defaultChatId}`);
    } else {
      addToast({
        id: Date.now().toString(),
        title: 'Dispatch Failed',
        preview: res.error || 'Check Chat ID and Bot permissions.',
        type: 'error'
      });
      addLog('error', `Telegram test send failed: ${res.error}`);
    }
  };

  // Simulator Interaction Logic
  const handleSimSend = (text: string) => {
    if (!text.trim()) return;

    playSoftClick();
    const userMsg: SimulatedMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setSimMessages((prev) => [...prev, userMsg]);
    setSimInput('');

    // Process Bot Response
    setTimeout(() => {
      processSimulatorBotResponse(text);
    }, 400);
  };

  const handleSimButtonClick = (callback: string) => {
    playSoftClick();
    if (callback === 'cmd_mail') {
      handleSimSend('📧 Mail');
    } else if (callback === 'cmd_check') {
      handleSimSend('🔄 Check All');
    } else if (callback === 'cmd_add') {
      handleSimSend('➕ Add Account');
    } else if (callback === 'cmd_remove') {
      handleSimSend('🗑️ Remove');
    } else if (callback.startsWith('select_')) {
      const email = callback.replace('select_', '');
      const acc = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
      const msgs = acc?.messages || [];
      const buttons: { text: string; callback: string }[][] = msgs.slice(0, 5).map((m, i) => [
        { text: `📧 ${m.subject.slice(0, 24)}...`, callback: `msg_${email}_${i}` }
      ]);
      buttons.push([
        { text: '🔄 Refresh', callback: `refresh_${email}` },
        { text: '📂 Old (100)', callback: `old_${email}` }
      ]);
      buttons.push([{ text: '🔙 Back', callback: 'cmd_mail' }]);

      const botReply: SimulatedMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: `📬 <b>Inbox for ${email}</b> (${msgs.length} messages):\nSelect a message to read:`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        buttons
      };
      setSimMessages((prev) => [...prev, botReply]);
      playTelegramPing();
    } else if (callback.startsWith('msg_')) {
      const parts = callback.split('_');
      const email = parts[1];
      const idx = parseInt(parts[2]);
      const acc = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
      const msg = acc?.messages?.[idx];

      if (msg) {
        const senderName = msg.from?.emailAddress?.name || msg.from?.name || 'Unknown';
        const senderAddr = msg.from?.emailAddress?.address || msg.from?.address || 'Unknown';
        const botReply: SimulatedMessage = {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: `📧 <b>From:</b> ${senderName} &lt;${senderAddr}&gt;\n📝 <b>Subject:</b> ${msg.subject}\n🕐 <b>Date:</b> ${new Date(msg.receivedDateTime).toLocaleString()}\n👤 <b>Account:</b> ${email}\n────────────────\n${msg.bodyPreview}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          buttons: [[{ text: '🔙 Back to Inbox', callback: `select_${email}` }]]
        };
        setSimMessages((prev) => [...prev, botReply]);
        playTelegramPing();
      }
    } else if (callback.startsWith('refresh_')) {
      const email = callback.replace('refresh_', '');
      const botReply: SimulatedMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: `🔄 <b>Refreshed ${email}!</b>\nChecked live via Microsoft Graph API. Status: 200 OK`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        buttons: [[{ text: '📬 View Messages', callback: `select_${email}` }]]
      };
      setSimMessages((prev) => [...prev, botReply]);
      playTelegramPing();
    }
  };

  const processSimulatorBotResponse = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === '/start') {
      const reply: SimulatedMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: '👋 <b>Mail Checker Bot</b>\n\nSend: <code>mail|password|refresh_token|clientid</code>\nor use the interactive keyboard:',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        buttons: [
          [
            { text: '📧 Mail Accounts', callback: 'cmd_mail' },
            { text: '🔄 Check All Inboxes', callback: 'cmd_check' }
          ]
        ]
      };
      setSimMessages((prev) => [...prev, reply]);
      playTelegramPing();
    } else if (trimmed === '📧 Mail' || trimmed === '📧 Mail Accounts') {
      const buttons = accounts.map((a) => [
        { text: `📬 ${a.email}`, callback: `select_${a.email}` }
      ]);
      const reply: SimulatedMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: `📬 <b>Your Connected Inboxes (${accounts.length}):</b>\nClick an account to inspect messages:`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        buttons: buttons.length > 0 ? buttons : [[{ text: '➕ Add Account First', callback: 'cmd_add' }]]
      };
      setSimMessages((prev) => [...prev, reply]);
      playTelegramPing();
    } else if (trimmed === '🔄 Check All') {
      const summary = accounts
        .map((a) => `✅ <b>${a.email}</b>: ${a.messages?.length || 0} msgs`)
        .join('\n');
      const reply: SimulatedMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: `📊 <b>Sync Check Completed:</b>\n\n${summary || 'No accounts registered.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setSimMessages((prev) => [...prev, reply]);
      playTelegramPing();
    } else if (trimmed.includes('|')) {
      const parts = trimmed.split('|').map((p) => p.trim());
      if (parts.length >= 3) {
        const email = parts[0];
        const password = parts.length >= 4 ? parts[1] : '';
        const refreshToken = parts.length >= 4 ? parts[2] : parts[1];
        const clientId = parts.length >= 4 ? parts[3] : parts[2];

        // Register in app state
        const newAcc: MailAccount = {
          id: `acc_${Date.now()}`,
          email,
          password,
          refreshToken,
          clientId: clientId || 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
          userId: telegramSettings.defaultChatId || '',
          status: 'connected',
          lastChecked: new Date().toISOString(),
          label: 'Added via Telegram Bot',
          color: '#0078D4',
          messages: []
        };
        setAccounts((prev) => [newAcc, ...prev]);

        const reply: SimulatedMessage = {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: `✅ <b>${email}</b>\nPassword: ${password || '(hidden)'}\n\n📬 <b>Mail added successfully!</b>\nSaved to Windows 11 Controller fleet.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          buttons: [
            [
              { text: '🔄 Refresh', callback: `refresh_${email}` },
              { text: '📂 Old', callback: `old_${email}` }
            ]
          ]
        };
        setSimMessages((prev) => [...prev, reply]);
        playTelegramPing();
        addToast({
          id: Date.now().toString(),
          title: 'Account Added via Bot',
          preview: `${email} registered in local fleet.`,
          type: 'system'
        });
      }
    } else {
      const reply: SimulatedMessage = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: `🤖 <i>Received command: "${trimmed}"</i>\nTo register an account send:\n<code>mail|password|refresh_token|clientid</code>`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setSimMessages((prev) => [...prev, reply]);
    }
  };

  return (
    <div id="telegram-bot-view" className="flex-1 flex flex-col h-full overflow-hidden p-5 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center space-x-2">
          <Bot className="w-5 h-5 text-sky-500" />
          <span>Telegram Bot Controller & Interactive Simulator</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure Bot API credentials, test notifications, and simulate Telegram bot client interaction live.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        {/* Left Column: Bot Settings & Test Dispatcher (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4 overflow-y-auto pr-1">
          {/* Credentials Card */}
          <div
            className={`p-4 rounded-xl border space-y-3 ${
              darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
            } shadow-2xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>Telegram Bot Configuration</span>
              </span>

              {telegramSettings.botStatus === 'valid' ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>@{telegramSettings.botUsername || 'Active'}</span>
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                  Not Verified
                </span>
              )}
            </div>

            {/* Token Input */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Telegram Bot Token (From @BotFather)
              </label>
              <div className="flex space-x-2">
                <input
                  id="input-telegram-token"
                  type="password"
                  placeholder="e.g. 7182948192:AAH9f29104_sampleTokenHere"
                  value={telegramSettings.botToken}
                  onChange={(e) =>
                    setTelegramSettings((prev) => ({ ...prev, botToken: e.target.value }))
                  }
                  className={`flex-1 p-2 text-xs font-mono rounded-lg border transition ${
                    darkMode
                      ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
                <button
                  id="btn-test-telegram-token"
                  onClick={handleTestBotConnection}
                  disabled={testingToken}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium shadow-md shadow-sky-500/20 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingToken ? 'animate-spin' : ''}`} />
                  <span>{testingToken ? 'Verifying...' : 'Test Token'}</span>
                </button>
              </div>
              {telegramSettings.lastTestResult && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  {telegramSettings.lastTestResult}
                </p>
              )}
            </div>

            {/* Default Chat ID */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Default Target Chat ID / User ID (From @userinfobot or channel ID)
              </label>
              <input
                id="input-telegram-chatid"
                type="text"
                placeholder="e.g. 682910482 or -100192837492"
                value={telegramSettings.defaultChatId}
                onChange={(e) =>
                  setTelegramSettings((prev) => ({ ...prev, defaultChatId: e.target.value }))
                }
                className={`w-full p-2 text-xs font-mono rounded-lg border transition ${
                  darkMode
                    ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Automated Dispatch Rules */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Automation & Forwarding Rules:
              </span>

              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    Auto-Forward New Inbound Emails
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Dispatches alert to Telegram whenever a new email is detected during sync.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={telegramSettings.autoForward}
                  onChange={(e) =>
                    setTelegramSettings((prev) => ({ ...prev, autoForward: e.target.checked }))
                  }
                  className="rounded text-sky-600"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    Include Gemini AI Summaries & OTP Codes
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Attaches instant 2-sentence summary and extracted codes to Telegram alert.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={telegramSettings.includeAiSummary}
                  onChange={(e) =>
                    setTelegramSettings((prev) => ({
                      ...prev,
                      includeAiSummary: e.target.checked
                    }))
                  }
                  className="rounded text-sky-600"
                />
              </label>
            </div>
          </div>

          {/* Test Real Telegram Message Card */}
          <div
            className={`p-4 rounded-xl border space-y-3 ${
              darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
            } shadow-2xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Send className="w-3.5 h-3.5" />
                <span>Live Telegram Dispatcher</span>
              </span>
            </div>

            <textarea
              id="input-telegram-test-msg"
              rows={2}
              value={testMessageText}
              onChange={(e) => setTestMessageText(e.target.value)}
              placeholder="Type a test alert..."
              className={`w-full p-2.5 text-xs rounded-lg border ${
                darkMode
                  ? 'bg-slate-950 border-slate-700 text-slate-100'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />

            <div className="flex justify-end">
              <button
                id="btn-send-test-telegram"
                onClick={handleSendTestMessage}
                disabled={sendingTest}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-md shadow-sky-500/25 transition disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${sendingTest ? 'animate-spin' : ''}`} />
                <span>{sendingTest ? 'Sending...' : 'Send Live Test to Telegram'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Telegram Client Simulator (5 cols) */}
        <div
          className={`lg:col-span-5 rounded-2xl border flex flex-col overflow-hidden shadow-xl ${
            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
          }`}
        >
          {/* Simulator Top Bar */}
          <div className="p-3 bg-sky-600 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-white text-sky-600 flex items-center justify-center font-bold text-xs shadow-xs">
                🤖
              </div>
              <div>
                <h4 className="text-xs font-bold leading-tight">
                  {telegramSettings.botUsername ? `@${telegramSettings.botUsername}` : 'WinMail Alert Bot'}
                </h4>
                <span className="text-[10px] opacity-90">bot • online simulation</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSimMessages([
                  {
                    id: 'sim_init',
                    sender: 'bot',
                    text: '👋 <b>Mail Checker Bot</b>\n\nSend: <code>mail|password|refresh_token|clientid</code>\nor use the keyboard buttons:',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    buttons: [
                      [
                        { text: '📧 Mail Accounts', callback: 'cmd_mail' },
                        { text: '🔄 Check All', callback: 'cmd_check' }
                      ]
                    ]
                  }
                ]);
              }}
              className="p-1 rounded hover:bg-white/20 text-white"
              title="Reset Chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chat Messages Pane */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 font-sans text-xs">
            {simMessages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] p-3 rounded-2xl shadow-xs space-y-2 ${
                      isUser
                        ? 'bg-sky-600 text-white rounded-br-xs'
                        : darkMode
                        ? 'bg-slate-900 text-slate-100 border border-slate-800 rounded-bl-xs'
                        : 'bg-white text-slate-900 border border-slate-200 rounded-bl-xs'
                    }`}
                  >
                    <div
                      className="leading-relaxed whitespace-pre-wrap text-[11px]"
                      dangerouslySetInnerHTML={{ __html: msg.text }}
                    />

                    {/* Inline Keyboard Buttons */}
                    {msg.buttons && (
                      <div className="space-y-1 pt-1">
                        {msg.buttons.map((row, rIdx) => (
                          <div key={rIdx} className="flex gap-1 flex-wrap">
                            {row.map((btn, bIdx) => (
                              <button
                                key={bIdx}
                                onClick={() => handleSimButtonClick(btn.callback)}
                                className="flex-1 py-1 px-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 font-semibold text-[10px] border border-sky-500/30 transition text-center truncate"
                              >
                                {btn.text}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick Keyboard Buttons Bar */}
          <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-200/50 dark:bg-slate-900/50 grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleSimButtonClick('cmd_mail')}
              className="py-1.5 px-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold border border-slate-300 dark:border-slate-700 shadow-2xs text-center"
            >
              📧 Mail Accounts
            </button>
            <button
              onClick={() => handleSimButtonClick('cmd_check')}
              className="py-1.5 px-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold border border-slate-300 dark:border-slate-700 shadow-2xs text-center"
            >
              🔄 Check All Inboxes
            </button>
          </div>

          {/* Simulator Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSimSend(simInput);
            }}
            className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center space-x-2"
          >
            <input
              id="input-sim-message"
              type="text"
              placeholder="Send command or mail|password|token|id"
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              className={`flex-1 p-2 text-xs rounded-lg border ${
                darkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
            <button
              type="submit"
              className="p-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
              title="Send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
