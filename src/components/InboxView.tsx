import React, { useState, useMemo } from 'react';
import {
  Inbox,
  Star,
  Search,
  RotateCw,
  Send,
  Sparkles,
  CheckCircle,
  Copy,
  Code,
  ShieldAlert,
  Clock,
  User,
  Paperclip,
  Check,
  ChevronRight,
  Filter
} from 'lucide-react';
import { EmailMessage, MailAccount, TelegramSettings } from '../types';
import { summarizeEmailAi, sendTelegramAlert, fetchInboxMessages } from '../utils/apiService';
import { playTelegramPing, playSoftClick } from '../utils/audio';
import { copyToClipboard } from '../utils/clipboard';
import {
  ClickableNumber,
  ClickableEmail,
  RenderClickableText,
  extractNumbers4Plus,
  cleanHtmlToText
} from '../utils/clickableCodes';

interface InboxViewProps {
  accounts: MailAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<MailAccount[]>>;
  selectedAccountEmail: string | null;
  setSelectedAccountEmail: (email: string | null) => void;
  telegramSettings: TelegramSettings;
  darkMode: boolean;
  addToast: (toast: any) => void;
  addLog: (type: any, message: string, details?: string, accountEmail?: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  accounts,
  setAccounts,
  selectedAccountEmail,
  setSelectedAccountEmail,
  telegramSettings,
  darkMode,
  addToast,
  addLog
}) => {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<'all' | 'unread' | 'starred' | 'urgent'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDispatchingTelegram, setIsDispatchingTelegram] = useState(false);
  const [showJsonRaw, setShowJsonRaw] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);

  // Flatten all messages across selected account or all accounts
  const allMessages = useMemo(() => {
    let list: EmailMessage[] = [];
    if (selectedAccountEmail) {
      const target = accounts.find((a) => a.email.toLowerCase() === selectedAccountEmail.toLowerCase());
      if (target && target.messages) {
        list = target.messages;
      }
    } else {
      for (const acc of accounts) {
        if (acc.messages) {
          list = [...list, ...acc.messages];
        }
      }
    }
    // Sort by receivedDateTime desc
    return list.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());
  }, [accounts, selectedAccountEmail]);

  // Filter messages based on search and folder
  const filteredMessages = useMemo(() => {
    return allMessages.filter((msg) => {
      if (folderFilter === 'unread' && msg.isRead) return false;
      if (folderFilter === 'starred' && !msg.isStarred) return false;
      if (folderFilter === 'urgent' && msg.importance !== 'high' && msg.aiAnalysis?.urgency !== 'critical') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const senderName = msg.from?.emailAddress?.name || msg.from?.name || '';
      const senderAddr = msg.from?.emailAddress?.address || msg.from?.address || '';
      return (
        msg.subject.toLowerCase().includes(q) ||
        msg.bodyPreview.toLowerCase().includes(q) ||
        senderName.toLowerCase().includes(q) ||
        senderAddr.toLowerCase().includes(q) ||
        msg.accountEmail.toLowerCase().includes(q)
      );
    });
  }, [allMessages, folderFilter, searchQuery]);

  // Selected message
  const activeMessage = useMemo(() => {
    if (!selectedMessageId) {
      return filteredMessages.length > 0 ? filteredMessages[0] : null;
    }
    return allMessages.find((m) => m.id === selectedMessageId) || filteredMessages[0] || null;
  }, [allMessages, filteredMessages, selectedMessageId]);

  const handleSelectMessage = (msg: EmailMessage) => {
    setSelectedMessageId(msg.id);
    playSoftClick();
    // Mark as read locally
    if (!msg.isRead) {
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.email.toLowerCase() === msg.accountEmail.toLowerCase()) {
            return {
              ...acc,
              messages: acc.messages.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m))
            };
          }
          return acc;
        })
      );
    }
  };

  const handleToggleStar = (e: React.MouseEvent, msgId: string, accountEmail: string) => {
    e.stopPropagation();
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.email.toLowerCase() === accountEmail.toLowerCase()) {
          return {
            ...acc,
            messages: acc.messages.map((m) => (m.id === msgId ? { ...m, isStarred: !m.isStarred } : m))
          };
        }
        return acc;
      })
    );
  };

  const handleRefreshCurrent = async () => {
    setIsRefreshing(true);
    playSoftClick();

    const accountsToRefresh = selectedAccountEmail
      ? accounts.filter((a) => a.email.toLowerCase() === selectedAccountEmail.toLowerCase())
      : accounts;

    for (const acc of accountsToRefresh) {
      const res = await fetchInboxMessages(acc, { limit: showOld ? 100 : 20, showOld });
      if (res.messages) {
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === acc.id
              ? {
                  ...a,
                  messages: res.messages!,
                  status: 'connected',
                  lastChecked: new Date().toISOString()
                }
              : a
          )
        );
      }
    }

    setIsRefreshing(false);
    addToast({
      id: Date.now().toString(),
      title: 'Inbox Refreshed',
      preview: `Synced ${accountsToRefresh.length} account inboxes via Microsoft Graph.`,
      type: 'system'
    });
    addLog('info', 'Manually refreshed inbox messages', undefined, selectedAccountEmail || 'All Inboxes');
  };

  const handleAiSummarize = async () => {
    if (!activeMessage) return;
    setIsSummarizing(true);

    const res = await summarizeEmailAi(activeMessage);
    setIsSummarizing(false);

    if (res.ok && res.analysis) {
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.email.toLowerCase() === activeMessage.accountEmail.toLowerCase()) {
            return {
              ...acc,
              messages: acc.messages.map((m) =>
                m.id === activeMessage.id ? { ...m, aiAnalysis: res.analysis } : m
              )
            };
          }
          return acc;
        })
      );
      addToast({
        id: Date.now().toString(),
        title: 'AI Analysis Ready',
        preview: res.analysis.summary,
        type: 'system'
      });
      addLog('ai', `AI summarized: "${activeMessage.subject}"`, res.analysis.summary, activeMessage.accountEmail);
    } else {
      addToast({
        id: Date.now().toString(),
        title: 'AI Error',
        preview: res.error || 'Failed to generate AI analysis.',
        type: 'error'
      });
    }
  };

  const handleForwardToTelegram = async () => {
    if (!activeMessage) return;
    if (!telegramSettings.botToken) {
      addToast({
        id: Date.now().toString(),
        title: 'Telegram Not Configured',
        preview: 'Please configure your Telegram Bot Token in the Telegram Bot tab.',
        type: 'error'
      });
      return;
    }

    setIsDispatchingTelegram(true);
    const targetAcc = accounts.find((a) => a.email.toLowerCase() === activeMessage.accountEmail.toLowerCase());
    const targetChatId = targetAcc?.userId || telegramSettings.defaultChatId;

    const senderName = activeMessage.from?.emailAddress?.name || activeMessage.from?.name || 'Unknown';
    const senderAddr = activeMessage.from?.emailAddress?.address || activeMessage.from?.address || 'Unknown';

    let alertText =
      `📧 <b>EMAIL FORWARDED</b>\n\n` +
      `👤 <b>Account:</b> <code>${activeMessage.accountEmail}</code>\n` +
      `📨 <b>From:</b> ${senderName} &lt;${senderAddr}&gt;\n` +
      `📝 <b>Subject:</b> ${activeMessage.subject}\n` +
      `🕐 <b>Date:</b> ${new Date(activeMessage.receivedDateTime).toLocaleString()}\n\n` +
      `📄 <b>Preview:</b>\n<i>${activeMessage.bodyPreview || 'No preview text'}</i>`;

    if (activeMessage.aiAnalysis?.summary) {
      alertText += `\n\n🤖 <b>AI Summary:</b>\n${activeMessage.aiAnalysis.summary}`;
      if (activeMessage.aiAnalysis.extractedCodes?.length) {
        alertText += `\n🔑 <b>Extracted Code:</b> <code>${activeMessage.aiAnalysis.extractedCodes.join(', ')}</code>`;
      }
    }

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh Inbox', callback_data: `refresh_${activeMessage.accountEmail}` },
          { text: '📂 View 100 Old', callback_data: `old_${activeMessage.accountEmail}` }
        ]
      ]
    };

    const sendRes = await sendTelegramAlert(telegramSettings, targetChatId, alertText, replyMarkup);
    setIsDispatchingTelegram(false);

    if (sendRes.ok) {
      playTelegramPing();
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.email.toLowerCase() === activeMessage.accountEmail.toLowerCase()) {
            return {
              ...acc,
              messages: acc.messages.map((m) =>
                m.id === activeMessage.id ? { ...m, forwardedToTelegram: true } : m
              )
            };
          }
          return acc;
        })
      );
      addToast({
        id: Date.now().toString(),
        title: 'Forwarded to Telegram',
        preview: `Sent "${activeMessage.subject}" to Chat ID: ${targetChatId || 'Default'}`,
        type: 'telegram'
      });
      addLog('telegram', `Forwarded email to Telegram: ${activeMessage.subject}`, undefined, activeMessage.accountEmail);
    } else {
      addToast({
        id: Date.now().toString(),
        title: 'Telegram Send Failed',
        preview: sendRes.error || 'Could not dispatch message.',
        type: 'error'
      });
      addLog('error', `Failed to forward to Telegram: ${sendRes.error}`, undefined, activeMessage.accountEmail);
    }
  };

  const handleCopyOtpCode = async (code: string) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedCode(code);
      playSoftClick();
      addToast({
        id: Date.now().toString(),
        title: 'Code Copied',
        preview: `Copied "${code}" to clipboard.`,
        type: 'system'
      });
      setTimeout(() => setCopiedCode(null), 2500);
    } else {
      addToast({
        id: Date.now().toString(),
        title: 'Copy Failed',
        preview: 'Could not copy to clipboard.',
        type: 'error'
      });
    }
  };

  return (
    <div id="inbox-view" className="flex-1 flex h-full overflow-hidden">
      {/* Column 1: Folder & Account Filter Bar */}
      <div
        className={`w-60 shrink-0 border-r flex flex-col justify-between select-none ${
          darkMode ? 'bg-slate-950/40 border-slate-800/80' : 'bg-slate-50/70 border-slate-200/80'
        }`}
      >
        <div className="p-3 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Folders
            </span>
            <button
              onClick={handleRefreshCurrent}
              disabled={isRefreshing}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition"
              title="Refresh Current Inboxes"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>
          </div>

          <div className="space-y-1 text-xs">
            <button
              id="filter-all-inboxes"
              onClick={() => {
                setSelectedAccountEmail(null);
                setFolderFilter('all');
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition ${
                selectedAccountEmail === null && folderFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Inbox className="w-4 h-4" />
                <span>All Inboxes</span>
              </div>
              <span className="text-[11px] opacity-80">{allMessages.length}</span>
            </button>

            <button
              id="filter-unread"
              onClick={() => setFolderFilter('unread')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition ${
                folderFilter === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>Unread Messages</span>
              </div>
              <span className="text-[11px] opacity-80">
                {allMessages.filter((m) => !m.isRead).length}
              </span>
            </button>

            <button
              id="filter-starred"
              onClick={() => setFolderFilter('starred')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition ${
                folderFilter === 'starred'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Starred</span>
              </div>
              <span className="text-[11px] opacity-80">
                {allMessages.filter((m) => m.isStarred).length}
              </span>
            </button>

            <button
              id="filter-urgent"
              onClick={() => setFolderFilter('urgent')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition ${
                folderFilter === 'urgent'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                <span>Urgent & OTPs</span>
              </div>
              <span className="text-[11px] opacity-80">
                {
                  allMessages.filter(
                    (m) => m.importance === 'high' || m.aiAnalysis?.urgency === 'critical'
                  ).length
                }
              </span>
            </button>
          </div>

          {/* Accounts List */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Accounts ({accounts.length})
            </span>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {accounts.map((acc) => {
                const isSelected = selectedAccountEmail?.toLowerCase() === acc.email.toLowerCase();
                const unread = acc.messages?.filter((m) => !m.isRead).length || 0;
                return (
                  <button
                    key={acc.id}
                    id={`account-filter-${acc.id}`}
                    onClick={() => {
                      setSelectedAccountEmail(acc.email);
                      setFolderFilter('all');
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${
                      isSelected
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: acc.color || '#0078D4' }}
                      />
                      <span className="truncate">{acc.email.split('@')[0]}</span>
                    </div>
                    {unread > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-600 text-white font-bold">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Show Old Messages Toggle (100 Top limit) */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-xs">
          <label className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showOld}
              onChange={(e) => setShowOld(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span>Fetch 100 Old Items</span>
          </label>
        </div>
      </div>

      {/* Column 2: Message List */}
      <div
        className={`w-80 sm:w-96 shrink-0 border-r flex flex-col ${
          darkMode ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-200/80'
        }`}
      >
        {/* Search Header */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="input-inbox-search"
              type="text"
              placeholder="Search messages, OTPs, senders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border transition ${
                darkMode
                  ? 'bg-slate-950 border-slate-700 text-slate-200 placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>
              Showing {filteredMessages.length} of {allMessages.length}
            </span>
            {selectedAccountEmail && (
              <button
                onClick={() => setSelectedAccountEmail(null)}
                className="text-blue-500 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Message Items Container */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredMessages.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
              <Inbox className="w-8 h-8 mb-2 opacity-50" />
              <span>No messages found</span>
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isSelected = activeMessage?.id === msg.id;
              const senderName = msg.from?.emailAddress?.name || msg.from?.name || 'Unknown';
              const dateStr = new Date(msg.receivedDateTime).toLocaleDateString([], {
                month: 'short',
                day: 'numeric'
              });
              const isUnread = !msg.isRead;
              const hasOtp = msg.aiAnalysis?.extractedCodes && msg.aiAnalysis.extractedCodes.length > 0;

              return (
                <div
                  key={msg.id}
                  id={`msg-item-${msg.id}`}
                  onClick={() => handleSelectMessage(msg)}
                  className={`p-3 cursor-pointer transition-all ${
                    isSelected
                      ? darkMode
                        ? 'bg-blue-600/20 border-l-4 border-l-blue-500'
                        : 'bg-blue-50/90 border-l-4 border-l-blue-600'
                      : isUnread
                      ? darkMode
                        ? 'bg-slate-800/30 hover:bg-slate-800/60 font-semibold'
                        : 'bg-slate-50/60 hover:bg-slate-100/80 font-semibold'
                      : darkMode
                      ? 'hover:bg-slate-800/40 text-slate-300'
                      : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="flex items-center space-x-1.5 truncate">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                      )}
                      <span className="text-xs text-slate-900 dark:text-slate-100 truncate">
                        {senderName}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 text-[10px] text-slate-400">
                      <span>{dateStr}</span>
                      <button
                        onClick={(e) => handleToggleStar(e, msg.id, msg.accountEmail)}
                        className="p-0.5 text-slate-400 hover:text-amber-400"
                      >
                        <Star
                          className={`w-3 h-3 ${
                            msg.isStarred ? 'text-amber-400 fill-amber-400' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Subject */}
                  <h4
                    className={`text-xs leading-snug line-clamp-1 mb-1 ${
                      isUnread
                        ? 'font-bold text-slate-900 dark:text-slate-100'
                        : 'font-medium text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <RenderClickableText text={msg.subject} onCopied={handleCopyOtpCode} />
                  </h4>

                  {/* Body snippet with clickable 4+ digit numbers */}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    <RenderClickableText
                      text={cleanHtmlToText(msg.bodyPreview || '')}
                      onCopied={handleCopyOtpCode}
                    />
                  </p>

                  {/* Badges row */}
                  <div className="flex items-center space-x-1.5 mt-2 flex-wrap gap-y-1">
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {msg.accountEmail.split('@')[0]}
                    </span>
                    {msg.importance === 'high' && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-bold border border-red-500/20">
                        High Priority
                      </span>
                    )}
                    {/* Render all detected 4+ digit numbers as instant copy pills */}
                    {extractNumbers4Plus(`${msg.subject} ${msg.bodyPreview || ''}`).slice(0, 3).map((code) => (
                      <ClickableNumber key={code} num={code} onCopied={handleCopyOtpCode} />
                    ))}
                    {msg.forwardedToTelegram && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium">
                        Sent to TG
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Column 3: Full Reading Pane */}
      <div
        className={`flex-1 flex flex-col overflow-hidden ${
          darkMode ? 'bg-slate-950/60' : 'bg-slate-50/50'
        }`}
      >
        {activeMessage ? (
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-5 space-y-4">
            {/* Header & Quick Action Buttons */}
            <div
              className={`p-4 rounded-xl border ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              } shadow-2xs space-y-3`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {activeMessage.subject}
                </h2>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    id="btn-forward-telegram"
                    onClick={handleForwardToTelegram}
                    disabled={isDispatchingTelegram}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-md shadow-sky-500/20 transition disabled:opacity-50"
                    title="Send this email to Telegram"
                  >
                    <Send className={`w-3.5 h-3.5 ${isDispatchingTelegram ? 'animate-bounce' : ''}`} />
                    <span>{isDispatchingTelegram ? 'Sending...' : 'Send to Telegram'}</span>
                  </button>

                  <button
                    id="btn-ai-summarize"
                    onClick={handleAiSummarize}
                    disabled={isSummarizing}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition disabled:opacity-50"
                    title="Summarize email and extract OTPs using Gemini AI"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                    <span>{isSummarizing ? 'Analyzing...' : 'AI Summary'}</span>
                  </button>

                  <button
                    onClick={() => setShowJsonRaw(!showJsonRaw)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs"
                    title="Inspect Raw JSON"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sender, Recipient & Date details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-1 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    {(activeMessage.from?.emailAddress?.name || 'U').substring(0, 1)}
                  </div>
                  <div className="flex items-center flex-wrap gap-1">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {activeMessage.from?.emailAddress?.name || 'Unknown Sender'}
                    </span>
                    {activeMessage.from?.emailAddress?.address && (
                      <ClickableEmail
                        email={activeMessage.from.emailAddress.address}
                        onCopied={handleCopyOtpCode}
                        showIcon={true}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-[11px] flex-wrap">
                  <span>To:</span>
                  <ClickableEmail
                    email={activeMessage.accountEmail}
                    onCopied={handleCopyOtpCode}
                    showIcon={true}
                  />
                  <span>
                    {new Date(activeMessage.receivedDateTime).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Summary Banner (if generated) */}
            {activeMessage.aiAnalysis && (
              <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 dark:bg-purple-950/30 backdrop-blur-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      Gemini Intelligence Summary • {activeMessage.aiAnalysis.category}
                    </h3>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      activeMessage.aiAnalysis.urgency === 'critical'
                        ? 'bg-red-500 text-white'
                        : activeMessage.aiAnalysis.urgency === 'high'
                        ? 'bg-amber-500 text-white'
                        : 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200'
                    }`}
                  >
                    {activeMessage.aiAnalysis.urgency} Urgency
                  </span>
                </div>

                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {activeMessage.aiAnalysis.summary}
                </p>

                {/* Extracted Verification Codes */}
                {activeMessage.aiAnalysis.extractedCodes &&
                  activeMessage.aiAnalysis.extractedCodes.length > 0 && (
                    <div className="flex items-center space-x-2 pt-1">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Extracted Code:
                      </span>
                      {activeMessage.aiAnalysis.extractedCodes.map((code) => (
                        <button
                          key={code}
                          onClick={() => handleCopyOtpCode(code)}
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-xs shadow-xs transition"
                          title="Click to copy"
                        >
                          <span>{code}</span>
                          {copiedCode === code ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                {/* Action Items */}
                {activeMessage.aiAnalysis.actionItem && (
                  <div className="text-xs text-slate-700 dark:text-slate-300 pt-1">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Next Step:{' '}
                    </span>
                    {activeMessage.aiAnalysis.actionItem}
                  </div>
                )}

                {/* Suggested Reply */}
                {activeMessage.aiAnalysis.suggestedReply && (
                  <div className="mt-2 p-2.5 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-purple-300/40 dark:border-purple-800/40 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-purple-700 dark:text-purple-300 text-[11px]">
                        Suggested Quick Reply:
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeMessage.aiAnalysis?.suggestedReply || '');
                          addToast({
                            id: Date.now().toString(),
                            title: 'Draft Copied',
                            preview: 'AI reply draft copied to clipboard.',
                            type: 'system'
                          });
                        }}
                        className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        <span>Copy Reply</span>
                      </button>
                    </div>
                    <p className="italic text-slate-600 dark:text-slate-300">
                      &quot;{activeMessage.aiAnalysis.suggestedReply}&quot;
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Auto-Detected 4+ Digit Codes / OTP Bar */}
            {(() => {
              const rawBody = activeMessage.body?.content || activeMessage.bodyPreview || '';
              const fullText = `${activeMessage.subject} ${cleanHtmlToText(rawBody)}`;
              const detectedCodes = extractNumbers4Plus(fullText);

              if (detectedCodes.length === 0) return null;

              return (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center space-x-1">
                      <span>🔑 Detected Numbers & OTPs (Click to Copy):</span>
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-1.5">
                    {detectedCodes.map((code) => (
                      <button
                        key={code}
                        id={`btn-copy-detected-code-${code}`}
                        onClick={() => handleCopyOtpCode(code)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-xs shadow-xs transition transform active:scale-95 ${
                          copiedCode === code
                            ? 'bg-emerald-600 text-white shadow-emerald-500/30'
                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950 hover:text-white shadow-amber-500/20'
                        }`}
                        title="Click to copy this number"
                      >
                        <span>{code}</span>
                        {copiedCode === code ? (
                          <Check className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Email Body Content with Clickable 4+ Digit Numbers */}
            <div
              className={`p-5 rounded-xl border flex-1 ${
                darkMode ? 'bg-slate-900/60 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              } shadow-2xs font-sans text-xs leading-relaxed whitespace-pre-wrap`}
            >
              <RenderClickableText
                text={cleanHtmlToText(
                  activeMessage.body?.content || activeMessage.bodyPreview || 'No text content available.'
                )}
                onCopied={handleCopyOtpCode}
              />
            </div>

            {/* Raw JSON Inspector */}
            {showJsonRaw && (
              <div className="p-4 rounded-xl bg-slate-950 text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                <pre>{JSON.stringify(activeMessage, null, 2)}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <Inbox className="w-12 h-12 mb-3 opacity-40" />
            <h3 className="text-sm font-semibold">Select an email to read</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              View real-time headers, full message preview, AI triage, and forward directly to Telegram.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
