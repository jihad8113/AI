import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  FileText,
  Copy,
  Check,
  Download,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  X,
  Shield,
  FileCode,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { MailAccount } from '../types';
import { fetchStaticPaData, saveStaticPaData } from '../utils/apiService';
import { playSoftClick, playWindowsNotificationSound } from '../utils/audio';
import { copyToClipboard } from '../utils/clipboard';

interface StaticPaModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: MailAccount[];
  darkMode: boolean;
  addToast: (toast: any) => void;
  addLog: (type: any, message: string, details?: string, accountEmail?: string) => void;
}

export const StaticPaModal: React.FC<StaticPaModalProps> = ({
  isOpen,
  onClose,
  accounts,
  darkMode,
  addToast,
  addLog
}) => {
  const DEFAULT_STATIC_PASSWORD = 'S-and-T@7-2026';

  const [staticPassword, setStaticPassword] = useState<string>(DEFAULT_STATIC_PASSWORD);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [customEmailsInput, setCustomEmailsInput] = useState<string>('');
  const [isRawEditor, setIsRawEditor] = useState<boolean>(false);
  const [rawText, setRawText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Initialize emails from accounts
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, accounts]);

  const loadInitialData = async () => {
    setIsLoading(true);
    // Extract unique account emails
    const fleetEmails = accounts
      .map((a) => a.email.trim())
      .filter((e) => e.length > 0);
    const uniqueFleetEmails = Array.from(new Set(fleetEmails));

    // Try fetching existing data from server /src/STP.txt
    const serverData = await fetchStaticPaData();
    if (serverData.ok) {
      if (serverData.password) {
        setStaticPassword(serverData.password);
      }
      if (serverData.emails && serverData.emails.length > 0) {
        // Merge server emails with current fleet emails
        const combined = Array.from(
          new Set([...uniqueFleetEmails, ...serverData.emails])
        );
        setSelectedEmails(combined);
      } else if (uniqueFleetEmails.length > 0) {
        setSelectedEmails(uniqueFleetEmails);
      } else {
        setSelectedEmails([
          'nsnfnforo@hotmail.com',
          'nsnfnoro@hotmail.com',
          'snfforo@hotmail.com'
        ]);
      }
    } else {
      // Fallback defaults
      if (uniqueFleetEmails.length > 0) {
        setSelectedEmails(uniqueFleetEmails);
      } else {
        setSelectedEmails([
          'nsnfnforo@hotmail.com',
          'nsnfnoro@hotmail.com',
          'snfforo@hotmail.com'
        ]);
      }
    }
    setIsLoading(false);
  };

  // Generate formatted STP text: emails followed by the static password on the final line
  const generateStpContent = (emailsList: string[], pass: string) => {
    const cleanEmails = emailsList.map((e) => e.trim()).filter((e) => e.length > 0);
    return `${cleanEmails.join('\n')}\n${pass.trim()}`;
  };

  const currentGeneratedText = generateStpContent(selectedEmails, staticPassword);

  // Update raw editor when switching
  useEffect(() => {
    if (!isRawEditor) {
      setRawText(currentGeneratedText);
    }
  }, [selectedEmails, staticPassword, isRawEditor, currentGeneratedText]);

  const triggerCopy = async (key: string, text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      playSoftClick();
      addToast({
        id: Date.now().toString(),
        title: 'Copied to Clipboard',
        preview: `${label} copied successfully.`,
        type: 'system'
      });
    }
  };

  const handleSaveToSrc = async () => {
    setIsSaving(true);
    playSoftClick();

    let contentToSave = '';
    if (isRawEditor) {
      contentToSave = rawText;
    } else {
      contentToSave = generateStpContent(selectedEmails, staticPassword);
    }

    const res = await saveStaticPaData({
      content: contentToSave,
      password: staticPassword,
      emails: selectedEmails
    });

    setIsSaving(false);

    if (res.ok) {
      playWindowsNotificationSound();
      setLastSavedTime(new Date().toLocaleTimeString());
      addToast({
        id: Date.now().toString(),
        title: '💾 Saved to src/STP.txt',
        preview: `Successfully updated STP.txt in the src directory with ${selectedEmails.length} emails and static password.`,
        type: 'system'
      });
      addLog(
        'success',
        'Updated /src/STP.txt file',
        `Saved ${selectedEmails.length} mail accounts and static password.`
      );
    } else {
      addToast({
        id: Date.now().toString(),
        title: 'Error Saving STP.txt',
        preview: res.error || 'Could not write to /src/STP.txt',
        type: 'error'
      });
      addLog('error', 'Failed to update /src/STP.txt', res.error);
    }
  };

  const handleDownloadFile = () => {
    playSoftClick();
    const textToDownload = isRawEditor ? rawText : currentGeneratedText;
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'STP.txt';
    a.click();
    URL.revokeObjectURL(url);

    addToast({
      id: Date.now().toString(),
      title: 'STP.txt Downloaded',
      preview: 'Downloaded static password array file to your device.',
      type: 'system'
    });
  };

  const handleToggleEmail = (email: string) => {
    if (selectedEmails.includes(email)) {
      setSelectedEmails(selectedEmails.filter((e) => e !== email));
    } else {
      setSelectedEmails([...selectedEmails, email]);
    }
  };

  const handleSelectAll = () => {
    const fleetEmails = accounts.map((a) => a.email.trim()).filter(Boolean);
    const combined = Array.from(new Set([...selectedEmails, ...fleetEmails]));
    setSelectedEmails(combined);
  };

  const handleAddCustomEmails = () => {
    if (!customEmailsInput.trim()) return;
    const lines = customEmailsInput
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter((l) => l.includes('@'));
    if (lines.length > 0) {
      setSelectedEmails(Array.from(new Set([...selectedEmails, ...lines])));
      setCustomEmailsInput('');
      addToast({
        id: Date.now().toString(),
        title: 'Emails Added',
        preview: `Added ${lines.length} custom email addresses to Static PA list.`,
        type: 'system'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-static-pa"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          darkMode
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Static PA (STP.txt) Manager
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                  src/STP.txt
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Displays all fleet mail accounts with a single static password and syncs directly to <code className="font-mono text-indigo-500">src/STP.txt</code>.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {/* Static Password Control Card */}
          <div
            className={`p-3 rounded-xl border ${
              darkMode
                ? 'bg-slate-950/60 border-indigo-900/40'
                : 'bg-indigo-50/60 border-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Static Password (Applied to All Mails)
                </span>
              </div>
              <button
                onClick={() => setStaticPassword(DEFAULT_STATIC_PASSWORD)}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                Reset Default ({DEFAULT_STATIC_PASSWORD})
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  id="input-static-password"
                  type={showPassword ? 'text' : 'password'}
                  value={staticPassword}
                  onChange={(e) => setStaticPassword(e.target.value)}
                  placeholder="Enter static password..."
                  className={`w-full px-3 py-1.5 pr-9 font-mono text-xs rounded-lg border transition ${
                    darkMode
                      ? 'bg-slate-900 border-slate-700 text-indigo-300 focus:border-indigo-500'
                      : 'bg-white border-slate-300 text-indigo-900 focus:border-indigo-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={() => triggerCopy('static-pass', staticPassword, 'Static Password')}
                className="px-2.5 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700/60 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 font-semibold flex items-center space-x-1 transition cursor-pointer"
                title="Copy Password Only"
              >
                {copiedKey === 'static-pass' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Copy Pass</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              You can edit this static password anytime. It will be appended on the final line of <code className="font-mono text-indigo-500">src/STP.txt</code>.
            </p>
          </div>

          {/* Email Accounts Selector Card */}
          <div
            className={`p-3 rounded-xl border ${
              darkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">
                  Included Mail Accounts ({selectedEmails.length})
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                >
                  Select All Fleet
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  onClick={() => setSelectedEmails([])}
                  className="text-[10px] text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Email Chips / Checklist */}
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 rounded-lg bg-white/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800">
              {selectedEmails.length === 0 ? (
                <div className="text-slate-400 italic text-[11px] p-1">
                  No emails selected. Click 'Select All Fleet' or paste custom emails below.
                </div>
              ) : (
                selectedEmails.map((email, idx) => (
                  <span
                    key={`${email}-${idx}`}
                    onClick={() => handleToggleEmail(email)}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30 transition cursor-pointer"
                    title="Click to remove"
                  >
                    <span>{email}</span>
                    <X className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
                  </span>
                ))
              )}
            </div>

            {/* Add Custom Emails Field */}
            <div className="mt-2 flex items-center space-x-2">
              <input
                type="text"
                value={customEmailsInput}
                onChange={(e) => setCustomEmailsInput(e.target.value)}
                placeholder="Add extra email (e.g. user@hotmail.com)..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomEmails();
                  }
                }}
                className={`flex-1 px-2.5 py-1 text-[11px] rounded-lg border transition ${
                  darkMode
                    ? 'bg-slate-900 border-slate-700 text-slate-200'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              />
              <button
                onClick={handleAddCustomEmails}
                disabled={!customEmailsInput.trim()}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] transition disabled:opacity-50 cursor-pointer"
              >
                Add Email
              </button>
            </div>
          </div>

          {/* Live Preview of src/STP.txt */}
          <div
            className={`rounded-xl border overflow-hidden ${
              darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 text-slate-100 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px]">
              <div className="flex items-center space-x-2">
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-slate-300 font-mono">src/STP.txt Live Preview</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  {selectedEmails.length + 1} lines
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsRawEditor(!isRawEditor)}
                  className="text-slate-400 hover:text-white font-semibold text-[10px] transition cursor-pointer"
                >
                  {isRawEditor ? '👁️ Switch to Preview' : '✏️ Direct Raw Edit'}
                </button>
                <button
                  onClick={() =>
                    triggerCopy(
                      'stp-full',
                      isRawEditor ? rawText : currentGeneratedText,
                      'STP.txt Content'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center space-x-1 transition cursor-pointer"
                >
                  {copiedKey === 'stp-full' ? (
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                  <span>Copy All</span>
                </button>
              </div>
            </div>

            {/* Code / Text Box */}
            {isRawEditor ? (
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                className="w-full p-3 font-mono text-[11px] bg-slate-950 text-emerald-400 border-none outline-hidden resize-y"
                placeholder="Enter raw text lines..."
              />
            ) : (
              <div className="p-3 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-48 overflow-y-auto space-y-0.5">
                {selectedEmails.map((email, i) => (
                  <div key={i} className="flex space-x-3 text-slate-300 hover:bg-slate-800/40 px-1 rounded">
                    <span className="text-slate-600 select-none w-5 text-right font-mono text-[10px]">
                      {i + 1}
                    </span>
                    <span className="text-blue-300">{email}</span>
                  </div>
                ))}
                <div className="flex space-x-3 text-amber-300 font-bold bg-amber-500/10 px-1 py-0.5 rounded mt-1 border-t border-slate-800">
                  <span className="text-amber-500/60 select-none w-5 text-right font-mono text-[10px]">
                    {selectedEmails.length + 1}
                  </span>
                  <span>{staticPassword}</span>
                  <span className="text-[9px] font-normal text-amber-400/60 ml-auto italic">
                    (Static Password)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
          <div className="flex items-center space-x-2 text-[10px] text-slate-500">
            {lastSavedTime && (
              <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>Saved at {lastSavedTime}</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadFile}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.txt)</span>
            </button>

            <button
              id="btn-save-stp-file"
              onClick={handleSaveToSrc}
              disabled={isSaving}
              className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-xs shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Saving...' : 'Save to src/STP.txt'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
