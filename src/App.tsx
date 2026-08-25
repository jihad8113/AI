import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { Navigation } from './components/Navigation';
import { InboxView } from './components/InboxView';
import { AccountsView } from './components/AccountsView';
import { TelegramBotView } from './components/TelegramBotView';
import { AutoCheckerSyncView } from './components/AutoCheckerSyncView';
import { AiAssistantView } from './components/AiAssistantView';
import { ExporterView } from './components/ExporterView';
import { SettingsView } from './components/SettingsView';
import { Windows11Notification } from './components/Windows11Notification';
import {
  MailAccount,
  TelegramSettings,
  SyncSettings,
  SyncLog,
  WinToast,
  ViewTab,
  EmailMessage
} from './types';
import {
  loadAccounts,
  saveAccounts,
  loadTelegramSettings,
  saveTelegramSettings,
  loadSyncSettings,
  saveSyncSettings,
  loadLogs,
  saveLogs,
  loadStaticPaPassword
} from './utils/storage';
import {
  fetchInboxMessages,
  sendTelegramAlert,
  summarizeEmailAi,
  syncFleetEmailsToStaticPa
} from './utils/apiService';
import { playWindowsNotificationSound, playTelegramPing } from './utils/audio';

export default function App() {
  const [accounts, setAccounts] = useState<MailAccount[]>(() => loadAccounts());
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>(() =>
    loadTelegramSettings()
  );
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() => loadSyncSettings());
  const [logs, setLogs] = useState<SyncLog[]>(() => loadLogs());
  const [toasts, setToasts] = useState<WinToast[]>([]);
  const [activeTab, setActiveTab] = useState<ViewTab>('inbox');
  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(60);
  const [density, setDensity] = useState<'compact' | 'ultra' | 'normal'>(() => {
    return (localStorage.getItem('winmail_density') as 'compact' | 'ultra' | 'normal') || 'compact';
  });

  const cycleDensity = () => {
    setDensity((prev) => {
      const next = prev === 'compact' ? 'ultra' : prev === 'ultra' ? 'normal' : 'compact';
      localStorage.setItem('winmail_density', next);
      return next;
    });
  };

  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const telegramRef = useRef(telegramSettings);
  telegramRef.current = telegramSettings;
  const syncRef = useRef(syncSettings);
  syncRef.current = syncSettings;
  const isInitialMount = useRef(true);

  // Persist State Changes & Auto-Sync Emails to src/STP.txt
  useEffect(() => {
    saveAccounts(accounts);
    // Automatically update src/STP.txt with current account emails while keeping the static password intact
    const currentEmails = accounts.map((a) => a.email.trim()).filter(Boolean);
    const currentPass = loadStaticPaPassword();
    syncFleetEmailsToStaticPa(currentEmails, currentPass);
  }, [accounts]);

  useEffect(() => {
    saveTelegramSettings(telegramSettings);
  }, [telegramSettings]);

  useEffect(() => {
    saveSyncSettings(syncSettings);
  }, [syncSettings]);

  useEffect(() => {
    saveLogs(logs);
  }, [logs]);

  // Log Helper
  const addLog = useCallback(
    (type: SyncLog['type'], message: string, details?: string, accountEmail?: string) => {
      const newLog: SyncLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        type,
        message,
        details,
        accountEmail
      };
      setLogs((prev) => [newLog, ...prev]);
    },
    []
  );

  // Toast Notification Helper
  const addToast = useCallback(
    (toast: Omit<WinToast, 'id' | 'timestamp'> & { id?: string }) => {
      const newToast: WinToast = {
        id: toast.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        title: toast.title,
        sender: toast.sender,
        preview: toast.preview,
        accountEmail: toast.accountEmail,
        type: toast.type || 'system',
        messageId: toast.messageId
      };
      setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

      // Auto-dismiss after 6 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 6000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Perform a full inbox check cycle across all registered accounts
  const runFleetCheck = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);

    const currentAccounts = accountsRef.current;
    const currentTelegram = telegramRef.current;
    const currentSync = syncRef.current;

    let newEmailsFoundTotal = 0;

    for (const acc of currentAccounts) {
      try {
        const res = await fetchInboxMessages(acc, {
          limit: currentSync.fetchLimit || 15,
          showOld: currentSync.showOldByDefault || false
        });

        if (res.messages) {
          const prevMsgIds = new Set((acc.messages || []).map((m) => m.id));
          const freshlyArrived = res.messages.filter((m) => !prevMsgIds.has(m.id));

          if (freshlyArrived.length > 0) {
            newEmailsFoundTotal += freshlyArrived.length;

            // Trigger Sound Chime
            if (currentSync.soundEnabled) {
              playWindowsNotificationSound();
            }

            // Show Toast Popup for newly arrived message
            if (currentSync.toastEnabled) {
              const latest = freshlyArrived[0];
              const senderName =
                latest.from?.emailAddress?.name || latest.from?.name || 'Unknown Sender';
              addToast({
                title: latest.subject,
                sender: senderName,
                preview: latest.bodyPreview || 'New email received via Microsoft Graph',
                accountEmail: acc.email,
                type: 'email',
                messageId: latest.id
              });
            }

            addLog(
              'success',
              `Received ${freshlyArrived.length} new email(s)`,
              freshlyArrived.map((m) => m.subject).join(', '),
              acc.email
            );

            // Auto-forward to Telegram if enabled
            if (currentTelegram.autoForward && currentTelegram.botToken) {
              for (const newMsg of freshlyArrived.slice(0, 3)) {
                const targetChatId = acc.userId || currentTelegram.defaultChatId;
                if (targetChatId) {
                  const senderName =
                    newMsg.from?.emailAddress?.name || newMsg.from?.name || 'Unknown';
                  const alertText =
                    `🔔 <b>NEW EMAIL RECEIVED!</b>\n\n` +
                    `👤 <b>Account:</b> <code>${acc.email}</code>\n` +
                    `📧 <b>From:</b> ${senderName}\n` +
                    `📝 <b>Subject:</b> ${newMsg.subject}\n` +
                    `🕐 <b>Date:</b> ${new Date(newMsg.receivedDateTime).toLocaleString()}\n\n` +
                    `📄 <b>Preview:</b>\n<i>${newMsg.bodyPreview || 'No content preview'}</i>`;

                  const replyMarkup = {
                    inline_keyboard: [
                      [
                        { text: '🔄 Refresh', callback_data: `refresh_${acc.email}` },
                        { text: '📂 Old (100)', callback_data: `old_${acc.email}` }
                      ]
                    ]
                  };

                  sendTelegramAlert(currentTelegram, targetChatId, alertText, replyMarkup).then(
                    (tgRes) => {
                      if (tgRes.ok) {
                        playTelegramPing();
                        addLog('telegram', `Alert dispatched for "${newMsg.subject}"`, undefined, acc.email);
                      }
                    }
                  );
                }
              }
            }
          }

          // Update Account state with latest messages
          setAccounts((prev) =>
            prev.map((a) =>
              a.id === acc.id
                ? {
                    ...a,
                    status: 'connected',
                    lastChecked: new Date().toISOString(),
                    messages: res.messages!,
                    lastError: undefined
                  }
                : a
            )
          );
        } else if (res.error) {
          setAccounts((prev) =>
            prev.map((a) =>
              a.id === acc.id
                ? {
                    ...a,
                    status: 'expired_token',
                    lastError: res.error,
                    lastChecked: new Date().toISOString()
                  }
                : a
            )
          );
          addLog('error', `Sync failed for ${acc.email}: ${res.error}`, undefined, acc.email);
        }
      } catch (err: any) {
        console.error('Fleet check error for', acc.email, err);
      }
    }

    setIsChecking(false);
  }, [addLog, addToast, isChecking]);

  // Automated Sync Background Timer
  useEffect(() => {
    if (!syncSettings.autoSyncEnabled) {
      setCountdown(syncSettings.intervalSeconds);
      return;
    }

    setCountdown(syncSettings.intervalSeconds);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          runFleetCheck();
          return syncSettings.intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [syncSettings.autoSyncEnabled, syncSettings.intervalSeconds, runFleetCheck]);

  // Calculate unread totals
  const unreadTotal = accounts.reduce((acc, curr) => {
    const unread = (curr.messages || []).filter((m) => !m.isRead).length;
    return acc + unread;
  }, 0);

  const handleOpenInboxForAccount = (email: string) => {
    setSelectedAccountEmail(email);
    setActiveTab('inbox');
  };

  const handleOpenMessage = (messageId: string, accountEmail?: string) => {
    if (accountEmail) {
      setSelectedAccountEmail(accountEmail);
    }
    setActiveTab('inbox');
  };

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden font-sans select-none density-${density} ${
        darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Windows 11 TitleBar */}
      <TitleBar
        syncSettings={syncSettings}
        telegramSettings={telegramSettings}
        isChecking={isChecking}
        countdown={countdown}
        onRefresh={() => {
          runFleetCheck();
          addToast({
            title: '🔄 Fleet Mail Check Triggered',
            preview: 'Checking latest emails and OTP codes across all connected mailboxes.',
            type: 'sync'
          });
        }}
        onSetCooldownInterval={(seconds: number) => {
          setSyncSettings((prev) => ({ ...prev, intervalSeconds: seconds, autoSyncEnabled: true }));
          setCountdown(seconds);
          addToast({
            title: '⏱️ Cooldown Interval Updated',
            preview: `Auto-sync cooldown set to ${seconds}s. Next sync running in ${seconds}s.`,
            type: 'system'
          });
        }}
        onToggleAutoSync={() => {
          setSyncSettings((prev) => {
            const next = !prev.autoSyncEnabled;
            addToast({
              title: next ? '▶️ Auto-Checking Resumed' : '⏸️ Auto-Checking Pushed / Stopped',
              preview: next
                ? `Background fleet check active every ${prev.intervalSeconds}s.`
                : 'Auto-checking is stopped. Click PUSH to Resume or Refresh to check instantly.',
              type: 'system'
            });
            return { ...prev, autoSyncEnabled: next };
          });
        }}
        onToggleSound={() =>
          setSyncSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
        }
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        density={density}
        onCycleDensity={cycleDensity}
      />

      {/* Main App Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Windows 11 Side Navigation */}
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          accounts={accounts}
          telegramSettings={telegramSettings}
          unreadTotal={unreadTotal}
          onOpenAddModal={() => setActiveTab('accounts')}
          darkMode={darkMode}
        />

        {/* Dynamic View Tab */}
        <main className="flex-1 flex flex-col overflow-hidden relative pb-16 md:pb-0">
          {activeTab === 'inbox' && (
            <InboxView
              accounts={accounts}
              setAccounts={setAccounts}
              selectedAccountEmail={selectedAccountEmail}
              setSelectedAccountEmail={setSelectedAccountEmail}
              telegramSettings={telegramSettings}
              darkMode={darkMode}
              addToast={addToast}
              addLog={addLog}
            />
          )}

          {activeTab === 'accounts' && (
            <AccountsView
              accounts={accounts}
              setAccounts={setAccounts}
              onOpenInboxForAccount={handleOpenInboxForAccount}
              darkMode={darkMode}
              addToast={addToast}
              addLog={addLog}
            />
          )}

          {activeTab === 'sync' && (
            <AutoCheckerSyncView
              syncSettings={syncSettings}
              setSyncSettings={setSyncSettings}
              logs={logs}
              setLogs={setLogs}
              isChecking={isChecking}
              onManualSync={runFleetCheck}
              countdown={countdown}
              accounts={accounts}
              darkMode={darkMode}
              addToast={addToast}
            />
          )}

          {activeTab === 'telegram' && (
            <TelegramBotView
              telegramSettings={telegramSettings}
              setTelegramSettings={setTelegramSettings}
              accounts={accounts}
              setAccounts={setAccounts}
              darkMode={darkMode}
              addToast={addToast}
              addLog={addLog}
            />
          )}

          {activeTab === 'ai' && (
            <AiAssistantView
              accounts={accounts}
              setAccounts={setAccounts}
              darkMode={darkMode}
              addToast={addToast}
              addLog={addLog}
              onOpenInboxForMessage={handleOpenMessage}
            />
          )}

          {activeTab === 'scripts' && (
            <ExporterView
              accounts={accounts}
              telegramSettings={telegramSettings}
              darkMode={darkMode}
              addToast={addToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              syncSettings={syncSettings}
              setSyncSettings={setSyncSettings}
              telegramSettings={telegramSettings}
              setTelegramSettings={setTelegramSettings}
              setAccounts={setAccounts}
              darkMode={darkMode}
              addToast={addToast}
              addLog={addLog}
            />
          )}
        </main>
      </div>

      {/* Floating Windows 11 Toast Notifications */}
      <Windows11Notification
        toasts={toasts}
        onDismiss={dismissToast}
        onOpenMessage={handleOpenMessage}
        darkMode={darkMode}
      />
    </div>
  );
}
