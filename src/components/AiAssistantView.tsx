import React, { useState } from 'react';
import {
  Sparkles,
  Key,
  ShieldAlert,
  Copy,
  Check,
  Send,
  MessageSquare,
  RefreshCw,
  Zap,
  CheckCircle,
  Clock,
  Inbox
} from 'lucide-react';
import { MailAccount, EmailMessage } from '../types';
import { summarizeEmailAi } from '../utils/apiService';
import { playSoftClick } from '../utils/audio';

interface AiAssistantViewProps {
  accounts: MailAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<MailAccount[]>>;
  darkMode: boolean;
  addToast: (toast: any) => void;
  addLog: (type: any, message: string, details?: string, accountEmail?: string) => void;
  onOpenInboxForMessage?: (msgId: string, email: string) => void;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  accounts,
  setAccounts,
  darkMode,
  addToast,
  addLog,
  onOpenInboxForMessage
}) => {
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<{ [key: string]: string }>({});

  // Collect all messages
  const allMessages: EmailMessage[] = [];
  for (const acc of accounts) {
    if (acc.messages) {
      allMessages.push(...acc.messages);
    }
  }

  // Extract all OTP verification codes
  const otpCards = allMessages
    .filter((m) => m.aiAnalysis?.extractedCodes && m.aiAnalysis.extractedCodes.length > 0)
    .flatMap((m) =>
      m.aiAnalysis!.extractedCodes!.map((code) => ({
        code,
        message: m,
        date: m.receivedDateTime,
        account: m.accountEmail
      }))
    );

  // Extract urgent action items
  const urgentEmails = allMessages.filter(
    (m) =>
      m.importance === 'high' ||
      m.aiAnalysis?.urgency === 'critical' ||
      m.aiAnalysis?.actionRequired === true
  );

  const handleBatchAnalyze = async () => {
    const unread = allMessages.filter((m) => !m.aiAnalysis);
    if (unread.length === 0) {
      addToast({
        id: Date.now().toString(),
        title: 'All Analyzed',
        preview: 'All current emails already have AI intelligence summaries.',
        type: 'system'
      });
      return;
    }

    setIsBatchAnalyzing(true);
    let successCount = 0;

    for (const msg of unread.slice(0, 10)) {
      const res = await summarizeEmailAi(msg);
      if (res.ok && res.analysis) {
        successCount++;
        setAccounts((prev) =>
          prev.map((acc) => {
            if (acc.email.toLowerCase() === msg.accountEmail.toLowerCase()) {
              return {
                ...acc,
                messages: acc.messages.map((m) =>
                  m.id === msg.id ? { ...m, aiAnalysis: res.analysis } : m
                )
              };
            }
            return acc;
          })
        );
      }
    }

    setIsBatchAnalyzing(false);
    addToast({
      id: Date.now().toString(),
      title: 'Batch Analysis Complete',
      preview: `Analyzed ${successCount} emails with Gemini AI.`,
      type: 'system'
    });
    addLog('ai', `Batch summarized ${successCount} emails with Gemini AI.`);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    playSoftClick();
    addToast({
      id: Date.now().toString(),
      title: 'Code Copied',
      preview: `Copied "${code}" to clipboard.`,
      type: 'system'
    });
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div id="ai-assistant-view" className="flex-1 flex flex-col h-full overflow-hidden p-5 space-y-4">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <span>Gemini AI Mail Intelligence & OTP Vault</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Automated verification code extraction, urgency triage, and smart reply generator.
          </p>
        </div>

        <button
          id="btn-batch-ai-analyze"
          onClick={handleBatchAnalyze}
          disabled={isBatchAnalyzing}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-purple-500/25 transition disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isBatchAnalyzing ? 'animate-spin' : ''}`} />
          <span>{isBatchAnalyzing ? 'Analyzing Fleet...' : 'Analyze All Unread Emails'}</span>
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto pr-1">
        {/* Left: OTP & Verification Codes Vault (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Key className="w-4 h-4 text-emerald-500" />
              <span>Extracted Verification Codes & OTPs ({otpCards.length})</span>
            </span>
          </div>

          {otpCards.length === 0 ? (
            <div
              className={`p-6 rounded-xl border text-center ${
                darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <Key className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                No active 2FA codes or OTPs detected yet.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click &quot;Analyze All Unread Emails&quot; or check incoming security emails.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {otpCards.map((otp, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                    darkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'
                  } shadow-2xs`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-mono font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider">
                        {otp.code}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                        OTP Code
                      </span>
                    </div>
                    <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                      {otp.message.subject}
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      From: {otp.message.from?.emailAddress?.name || 'Unknown'} • To: {otp.account}
                    </p>
                  </div>

                  <button
                    onClick={() => handleCopyCode(otp.code)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition shrink-0"
                  >
                    {copiedCode === otp.code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode === otp.code ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Urgent Action Items & Priority Board (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span>Urgent Emails & Action Items ({urgentEmails.length})</span>
            </span>
          </div>

          {urgentEmails.length === 0 ? (
            <div
              className={`p-6 rounded-xl border text-center ${
                darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                All clear! No critical action items pending.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {urgentEmails.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    darkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'
                  } shadow-2xs`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                        {msg.aiAnalysis?.urgency || 'High Priority'}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {msg.subject}
                      </h4>
                    </div>

                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(msg.receivedDateTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {msg.aiAnalysis?.summary || msg.bodyPreview}
                  </p>

                  {msg.aiAnalysis?.actionItem && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
                      <b>Action Item:</b> {msg.aiAnalysis.actionItem}
                    </div>
                  )}

                  {msg.aiAnalysis?.suggestedReply && (
                    <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-700 dark:text-purple-300 flex justify-between items-center">
                      <span className="truncate mr-2">
                        Draft reply: <i>&quot;{msg.aiAnalysis.suggestedReply}&quot;</i>
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.aiAnalysis?.suggestedReply || '');
                          addToast({
                            id: Date.now().toString(),
                            title: 'Reply Copied',
                            preview: 'Suggested reply copied to clipboard.',
                            type: 'system'
                          });
                        }}
                        className="text-purple-600 dark:text-purple-400 hover:underline font-bold shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
