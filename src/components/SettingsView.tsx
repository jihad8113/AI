import React from 'react';
import {
  Settings,
  Shield,
  Bell,
  Volume2,
  Key,
  RotateCcw,
  Sparkles,
  Save,
  Laptop,
  CheckCircle2
} from 'lucide-react';
import { SyncSettings, TelegramSettings, MailAccount } from '../types';
import { INITIAL_DEMO_ACCOUNTS, loadStaticPaPassword } from '../utils/storage';
import { syncFleetEmailsToStaticPa } from '../utils/apiService';

interface SettingsViewProps {
  syncSettings: SyncSettings;
  setSyncSettings: React.Dispatch<React.SetStateAction<SyncSettings>>;
  telegramSettings: TelegramSettings;
  setTelegramSettings: React.Dispatch<React.SetStateAction<TelegramSettings>>;
  setAccounts: React.Dispatch<React.SetStateAction<MailAccount[]>>;
  darkMode: boolean;
  addToast: (toast: any) => void;
  addLog: (type: any, message: string, details?: string, accountEmail?: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  syncSettings,
  setSyncSettings,
  telegramSettings,
  setTelegramSettings,
  setAccounts,
  darkMode,
  addToast,
  addLog
}) => {
  const handleRestoreDemoAccounts = () => {
    if (confirm('Restore sample demonstration inboxes with simulated emails?')) {
      setAccounts(INITIAL_DEMO_ACCOUNTS);
      syncFleetEmailsToStaticPa(
        INITIAL_DEMO_ACCOUNTS.map((a) => a.email.trim()).filter(Boolean),
        loadStaticPaPassword()
      );
      addToast({
        id: Date.now().toString(),
        title: 'Demo Inboxes Restored',
        preview: 'Sample Microsoft Graph accounts loaded.',
        type: 'system'
      });
      addLog('info', 'Restored sample demonstration accounts');
    }
  };

  const handleClearAllData = () => {
    if (confirm('Are you sure you want to clear all accounts and settings?')) {
      localStorage.clear();
      setAccounts([]);
      syncFleetEmailsToStaticPa([], loadStaticPaPassword());
      addToast({
        id: Date.now().toString(),
        title: 'Data Cleared',
        preview: 'All local accounts and credentials wiped.',
        type: 'warning'
      });
    }
  };

  return (
    <div id="settings-view" className="flex-1 flex flex-col h-full overflow-y-auto p-3 sm:p-4 space-y-3 max-w-3xl">
      <div>
        <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
          <Settings className="w-4 h-4 text-slate-500" />
          <span>Application Settings & Environment</span>
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Configure notification preferences, Microsoft Graph defaults, and data storage.
        </p>
      </div>

      {/* Notifications & Sound Card */}
      <div
        className={`p-3 rounded-lg border space-y-2 ${
          darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        } shadow-2xs`}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
          <Bell className="w-3 h-3" />
          <span>Sound & Notifications</span>
        </span>

        <div className="space-y-1.5 text-[11px] divide-y divide-slate-100 dark:divide-slate-800/80">
          <label className="flex items-center justify-between py-1.5 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Windows 11 Notification Sound Chime
              </span>
              <p className="text-[10px] text-slate-400">
                Synthesizes two-tone harmonious alert when new emails or Telegram alerts arrive.
              </p>
            </div>
            <input
              type="checkbox"
              checked={syncSettings.soundEnabled}
              onChange={(e) =>
                setSyncSettings((prev) => ({ ...prev, soundEnabled: e.target.checked }))
              }
              className="rounded text-blue-600 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-1.5 cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Windows 11 Action Center Toast Popups
              </span>
              <p className="text-[10px] text-slate-400">
                Displays floating translucent notifications in the bottom-right corner.
              </p>
            </div>
            <input
              type="checkbox"
              checked={syncSettings.toastEnabled}
              onChange={(e) =>
                setSyncSettings((prev) => ({ ...prev, toastEnabled: e.target.checked }))
              }
              className="rounded text-blue-600 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* AI Intelligence Card */}
      <div
        className={`p-3 rounded-lg border space-y-2 ${
          darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        } shadow-2xs`}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center space-x-1">
          <Sparkles className="w-3 h-3" />
          <span>Gemini AI Engine</span>
        </span>

        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
          The applet connects to <b>Gemini 3.7 Flash</b> via server-side API proxy to extract verification OTPs, urgency ratings, and reply drafts.
        </p>

        <div className="flex items-center space-x-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Server-side Gemini proxy initialized</span>
        </div>
      </div>

      {/* Storage & Fleet Reset Card */}
      <div
        className={`p-3 rounded-lg border space-y-2 ${
          darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        } shadow-2xs`}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
          <Shield className="w-3 h-3" />
          <span>Data Storage & Sample Data</span>
        </span>

        <div className="flex flex-wrap gap-2 pt-0.5">
          <button
            onClick={handleRestoreDemoAccounts}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Load Sample Inboxes</span>
          </button>

          <button
            onClick={handleClearAllData}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] font-semibold text-red-500 cursor-pointer"
          >
            <span>Wipe All Local Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
