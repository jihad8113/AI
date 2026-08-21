import React, { useState } from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCw,
  Volume2,
  VolumeX,
  Bell,
  Clock,
  Download,
  Trash2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Sparkles,
  Info,
  Terminal
} from 'lucide-react';
import { SyncSettings, SyncLog, MailAccount } from '../types';

interface AutoCheckerSyncViewProps {
  syncSettings: SyncSettings;
  setSyncSettings: React.Dispatch<React.SetStateAction<SyncSettings>>;
  logs: SyncLog[];
  setLogs: React.Dispatch<React.SetStateAction<SyncLog[]>>;
  isChecking: boolean;
  onManualSync: () => void;
  countdown: number;
  accounts: MailAccount[];
  darkMode: boolean;
}

export const AutoCheckerSyncView: React.FC<AutoCheckerSyncViewProps> = ({
  syncSettings,
  setSyncSettings,
  logs,
  setLogs,
  isChecking,
  onManualSync,
  countdown,
  accounts,
  darkMode
}) => {
  const [logFilter, setLogFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');

  const filteredLogs = logs.filter((l) => {
    if (logFilter !== 'all' && l.type !== logFilter) return false;
    if (!logSearch.trim()) return true;
    const q = logSearch.toLowerCase();
    return (
      l.message.toLowerCase().includes(q) ||
      (l.details && l.details.toLowerCase().includes(q)) ||
      (l.accountEmail && l.accountEmail.toLowerCase().includes(q))
    );
  });

  const handleExportLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.accountEmail ? `(${l.accountEmail}) ` : ''}${l.message}${
            l.details ? ` - ${l.details}` : ''
          }`
      )
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `winmail_sync_logs_${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => {
    if (confirm('Clear all activity logs?')) {
      setLogs([]);
    }
  };

  return (
    <div id="sync-view" className="flex-1 flex flex-col h-full overflow-hidden p-5 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center space-x-2">
          <Activity className="w-5 h-5 text-emerald-500" />
          <span>Automated Background Sync & Activity Monitor</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Real-time Microsoft Graph polling loop with automated Telegram notification dispatch.
        </p>
      </div>

      {/* Sync Control & Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Sync Controls (7 cols) */}
        <div
          className={`md:col-span-7 p-4 rounded-xl border space-y-3 ${
            darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
          } shadow-2xs`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Auto-Sync Engine Status
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center space-x-1.5 ${
                syncSettings.autoSyncEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${syncSettings.autoSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{syncSettings.autoSyncEnabled ? 'Loop Active' : 'Loop Paused'}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-toggle-autosync"
              onClick={() =>
                setSyncSettings((prev) => ({
                  ...prev,
                  autoSyncEnabled: !prev.autoSyncEnabled
                }))
              }
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition ${
                syncSettings.autoSyncEnabled
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
              }`}
            >
              {syncSettings.autoSyncEnabled ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Background Sync</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Auto-Sync</span>
                </>
              )}
            </button>

            <button
              id="btn-manual-sync-now"
              onClick={onManualSync}
              disabled={isChecking}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-800 dark:text-slate-200 transition disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-blue-500' : ''}`} />
              <span>{isChecking ? 'Syncing Inboxes...' : 'Sync Fleet Now'}</span>
            </button>

            {syncSettings.autoSyncEnabled && (
              <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono px-2 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>Next check in: <b>{countdown}s</b></span>
              </div>
            )}
          </div>

          {/* Sync Frequency Selector */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Poll Interval:
            </span>
            <div className="flex space-x-1">
              {[15, 30, 60, 120, 300].map((sec) => (
                <button
                  key={sec}
                  onClick={() =>
                    setSyncSettings((prev) => ({ ...prev, intervalSeconds: sec }))
                  }
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    syncSettings.intervalSeconds === sec
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Telemetry Stats (5 cols) */}
        <div
          className={`md:col-span-5 p-4 rounded-xl border flex flex-col justify-between ${
            darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
          } shadow-2xs`}
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fleet Sync Telemetry
          </span>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-xs">
              <span className="text-slate-400">Total Monitored</span>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {accounts.length} Inboxes
              </p>
            </div>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-xs">
              <span className="text-slate-400">Event Logs</span>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {logs.length}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-500">
            <span>Sound alerts: {syncSettings.soundEnabled ? '🔔 On' : '🔕 Muted'}</span>
            <span>Windows Toasts: {syncSettings.toastEnabled ? '✅ Enabled' : '❌ Off'}</span>
          </div>
        </div>
      </div>

      {/* Activity Log Terminal */}
      <div
        className={`flex-1 rounded-xl border flex flex-col overflow-hidden ${
          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
        } shadow-lg`}
      >
        {/* Terminal Header & Filter Bar */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold font-mono text-slate-200">
              Live Console Output & Graph Logs
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
              {filteredLogs.length} events
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Filter Pills */}
            <div className="flex space-x-1 text-[11px]">
              {['all', 'success', 'telegram', 'ai', 'error'].map((type) => (
                <button
                  key={type}
                  onClick={() => setLogFilter(type)}
                  className={`px-2 py-0.5 rounded capitalize font-mono ${
                    logFilter === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportLogs}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              title="Download Logs (.log)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleClearLogs}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-red-400 text-xs"
              title="Clear Logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Scroll View */}
        <div className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-1.5 divide-y divide-slate-800/40">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 text-xs">
              No log records matching filter.
            </div>
          ) : (
            filteredLogs.map((log) => {
              let badgeColor = 'bg-slate-800 text-slate-300';
              if (log.type === 'success') badgeColor = 'bg-emerald-950 text-emerald-400 border border-emerald-800';
              if (log.type === 'error') badgeColor = 'bg-red-950 text-red-400 border border-red-800';
              if (log.type === 'warning') badgeColor = 'bg-amber-950 text-amber-400 border border-amber-800';
              if (log.type === 'telegram') badgeColor = 'bg-sky-950 text-sky-400 border border-sky-800';
              if (log.type === 'ai') badgeColor = 'bg-purple-950 text-purple-400 border border-purple-800';

              return (
                <div key={log.id} className="pt-1 flex items-start space-x-2 text-[11px]">
                  <span className="text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>

                  <span className={`px-1.5 py-0.2 rounded font-bold shrink-0 ${badgeColor}`}>
                    {log.type.toUpperCase()}
                  </span>

                  {log.accountEmail && (
                    <span className="text-blue-400 shrink-0">
                      [{log.accountEmail.split('@')[0]}]
                    </span>
                  )}

                  <span className="text-slate-300 flex-1">{log.message}</span>

                  {log.details && (
                    <span className="text-slate-500 truncate max-w-xs">{log.details}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
