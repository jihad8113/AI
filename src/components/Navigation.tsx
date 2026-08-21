import React from 'react';
import {
  Inbox,
  Users,
  Activity,
  Bot,
  Sparkles,
  FileCode2,
  Settings,
  ShieldCheck,
  Zap,
  Plus
} from 'lucide-react';
import { ViewTab, MailAccount, TelegramSettings } from '../types';

interface NavigationProps {
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  accounts: MailAccount[];
  telegramSettings: TelegramSettings;
  unreadTotal: number;
  onOpenAddModal: () => void;
  darkMode: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  accounts,
  telegramSettings,
  unreadTotal,
  onOpenAddModal,
  darkMode
}) => {
  const navItems = [
    {
      id: 'inbox' as ViewTab,
      label: 'Inbox',
      icon: Inbox,
      badge: unreadTotal > 0 ? unreadTotal : null,
      badgeColor: 'bg-blue-600 text-white'
    },
    {
      id: 'accounts' as ViewTab,
      label: 'Accounts',
      icon: Users,
      badge: accounts.length,
      badgeColor: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
    },
    {
      id: 'sync' as ViewTab,
      label: 'Auto-Sync & Logs',
      icon: Activity,
      badge: 'Live',
      badgeColor: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold'
    },
    {
      id: 'telegram' as ViewTab,
      label: 'Telegram Bot',
      icon: Bot,
      statusDot:
        telegramSettings.botStatus === 'valid'
          ? 'bg-emerald-500'
          : telegramSettings.botToken
          ? 'bg-amber-500'
          : 'bg-slate-400'
    },
    {
      id: 'ai' as ViewTab,
      label: 'AI Mail Assistant',
      icon: Sparkles,
      badge: 'Gemini',
      badgeColor: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-2xs'
    },
    {
      id: 'scripts' as ViewTab,
      label: 'Windows 11 Runner',
      icon: FileCode2,
      badge: 'Python/Bat',
      badgeColor: 'bg-sky-500/20 text-sky-600 dark:text-sky-400'
    },
    {
      id: 'settings' as ViewTab,
      label: 'Settings',
      icon: Settings
    }
  ];

  return (
    <>
      {/* Desktop Sidebar (visible on md screens and up) */}
      <aside
        id="win11-sidebar"
        className={`hidden md:flex w-64 select-none shrink-0 flex-col justify-between border-r transition-colors duration-200 ${
          darkMode
            ? 'bg-slate-900/60 border-slate-800/80'
            : 'bg-slate-50/80 border-slate-200/80'
        }`}
      >
        {/* Top Action & Navigation list */}
        <div className="p-3 space-y-4">
          {/* Quick Add Account Button */}
          <button
            id="btn-sidebar-add-account"
            onClick={onOpenAddModal}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-medium text-xs shadow-md shadow-blue-500/25 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add / Bulk Accounts</span>
          </button>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? darkMode
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25 shadow-xs'
                        : 'bg-white text-blue-700 border border-blue-200/80 shadow-xs'
                      : darkMode
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {item.statusDot && (
                      <span className={`w-2 h-2 rounded-full ${item.statusDot}`} />
                    )}
                    {item.badge !== null && item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Account Fleet Summary */}
        <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1">
            <span>Fleet Health</span>
            <span className="text-emerald-500 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Ready</span>
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300/40 dark:border-slate-700/40 text-[11px] space-y-1.5">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span>Active Inboxes:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{accounts.length}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span>Telegram Link:</span>
              <span
                className={`font-semibold ${
                  telegramSettings.botStatus === 'valid'
                    ? 'text-emerald-500'
                    : 'text-amber-500'
                }`}
              >
                {telegramSettings.botStatus === 'valid' ? 'Connected' : 'Configure'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (Visible on mobile/Android screens) */}
      <nav
        id="mobile-bottom-nav"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1 py-2 border-t backdrop-blur-xl ${
          darkMode
            ? 'bg-slate-950/95 border-slate-800 text-slate-400'
            : 'bg-white/95 border-slate-200 text-slate-600'
        }`}
      >
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium transition ${
            activeTab === 'inbox' ? 'text-blue-500 font-bold' : ''
          }`}
        >
          <Inbox className="w-5 h-5 mb-0.5" />
          <span>Inbox</span>
          {unreadTotal > 0 && (
            <span className="absolute top-1 px-1 text-[8px] rounded-full bg-blue-600 text-white font-bold">
              {unreadTotal}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium transition ${
            activeTab === 'accounts' ? 'text-blue-500 font-bold' : ''
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>Accounts & Bulk</span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium transition ${
            activeTab === 'sync' ? 'text-blue-500 font-bold' : ''
          }`}
        >
          <Activity className="w-5 h-5 mb-0.5" />
          <span>Sync</span>
        </button>

        <button
          onClick={() => setActiveTab('telegram')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium transition ${
            activeTab === 'telegram' ? 'text-blue-500 font-bold' : ''
          }`}
        >
          <Bot className="w-5 h-5 mb-0.5" />
          <span>Telegram</span>
        </button>

        <button
          onClick={() => setActiveTab('scripts')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium transition ${
            activeTab === 'scripts' ? 'text-blue-500 font-bold' : ''
          }`}
        >
          <FileCode2 className="w-5 h-5 mb-0.5" />
          <span>Suite</span>
        </button>
      </nav>
    </>
  );
};
