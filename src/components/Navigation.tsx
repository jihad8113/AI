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
      label: 'Win11 Suite',
      icon: FileCode2,
      badge: 'Scripts',
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
      {/* Desktop Compact Sidebar */}
      <aside
        id="win11-sidebar"
        className={`hidden md:flex w-48 select-none shrink-0 flex-col justify-between border-r transition-colors duration-200 ${
          darkMode
            ? 'bg-slate-900/50 border-slate-800/80'
            : 'bg-slate-50/80 border-slate-200/80'
        }`}
      >
        {/* Top Action & Navigation list */}
        <div className="p-2 space-y-2">
          {/* Quick Add Account Button */}
          <button
            id="btn-sidebar-add-account"
            onClick={onOpenAddModal}
            className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2.5 rounded-md bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold text-[11px] shadow-sm shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add / Bulk Mails</span>
          </button>

          {/* Navigation Items */}
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    isActive
                      ? darkMode
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25 shadow-2xs font-semibold'
                        : 'bg-white text-blue-700 border border-blue-200/80 shadow-2xs font-semibold'
                      : darkMode
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {item.statusDot && (
                      <span className={`w-1.5 h-1.5 rounded-full ${item.statusDot}`} />
                    )}
                    {item.badge !== null && item.badge !== undefined && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded-full ${item.badgeColor}`}
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

        {/* Bottom Fleet Health Summary */}
        <div className="p-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium px-1">
            <span>Fleet Status</span>
            <span className="text-emerald-500 flex items-center space-x-0.5">
              <ShieldCheck className="w-3 h-3" />
              <span>Ready</span>
            </span>
          </div>

          <div className="p-2 rounded-md bg-slate-200/40 dark:bg-slate-800/40 border border-slate-300/40 dark:border-slate-700/40 text-[10px] space-y-1">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span>Inboxes:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{accounts.length}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span>Telegram:</span>
              <span
                className={`font-semibold ${
                  telegramSettings.botStatus === 'valid'
                    ? 'text-emerald-500'
                    : 'text-amber-500'
                }`}
              >
                {telegramSettings.botStatus === 'valid' ? 'Connected' : 'Unlinked'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        id="mobile-bottom-nav"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1 py-1.5 border-t backdrop-blur-xl shrink-0 ${
          darkMode
            ? 'bg-slate-950/95 border-slate-800 text-slate-400'
            : 'bg-white/95 border-slate-200 text-slate-600'
        }`}
      >
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex flex-col items-center justify-center p-1 rounded-md text-[9px] font-medium transition ${
            activeTab === 'inbox' ? 'text-blue-500 font-bold' : ''
          }`}
        >
          <Inbox className="w-4 h-4 mb-0.5" />
          <span>Inbox</span>
          {unreadTotal > 0 && (
            <span className="absolute top-0.5 px-1 text-[7px] rounded-full bg-blue-600 text-white font-bold">
              {unreadTotal}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex flex-col items-center justify-center p-1 rounded-md text-[9px] font-medium transition ${
            activeTab === 'accounts' ? 'text-blue-500 font-bold' : ''
          }`}
        >
          <Users className="w-4 h-4 mb-0.5" />
          <span>Accounts</span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`flex flex-col items-center justify-center p-1 rounded-md text-[9px] font-medium transition ${
            activeTab === 'sync' ? 'text-blue-500 font-bold' : ''
          }`}
        >
          <Activity className="w-4 h-4 mb-0.5" />
          <span>Sync</span>
        </button>

        <button
          onClick={() => setActiveTab('telegram')}
          className={`flex flex-col items-center justify-center p-1 rounded-md text-[9px] font-medium transition ${
            activeTab === 'telegram' ? 'text-blue-500 font-bold' : ''
          }`}
        >
          <Bot className="w-4 h-4 mb-0.5" />
          <span>Telegram</span>
        </button>

        <button
          onClick={() => setActiveTab('scripts')}
          className={`flex flex-col items-center justify-center p-1 rounded-md text-[9px] font-medium transition ${
            activeTab === 'scripts' ? 'text-blue-500 font-bold' : ''
          }`}
        >
          <FileCode2 className="w-4 h-4 mb-0.5" />
          <span>Suite</span>
        </button>
      </nav>
    </>
  );
};
