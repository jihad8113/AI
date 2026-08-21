import React from 'react';
import { Mail, Bot, AlertTriangle, CheckCircle, X, ExternalLink } from 'lucide-react';
import { WinToast } from '../types';

interface Windows11NotificationProps {
  toasts: WinToast[];
  onDismiss: (id: string) => void;
  onOpenMessage?: (messageId: string, accountEmail?: string) => void;
  darkMode: boolean;
}

export const Windows11Notification: React.FC<Windows11NotificationProps> = ({
  toasts,
  onDismiss,
  onOpenMessage,
  darkMode
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      id="win11-toast-container"
      className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        let Icon = Mail;
        let iconBg = 'bg-blue-600';
        if (toast.type === 'telegram') {
          Icon = Bot;
          iconBg = 'bg-sky-500';
        } else if (toast.type === 'error') {
          Icon = AlertTriangle;
          iconBg = 'bg-red-500';
        } else if (toast.type === 'system') {
          Icon = CheckCircle;
          iconBg = 'bg-emerald-500';
        }

        return (
          <div
            key={toast.id}
            id={`win11-toast-${toast.id}`}
            className={`pointer-events-auto rounded-xl p-3.5 shadow-2xl border transition-all transform animate-in slide-in-from-right-8 duration-200 ${
              darkMode
                ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 backdrop-blur-xl shadow-black/50'
                : 'bg-white/95 border-slate-200/90 text-slate-900 backdrop-blur-xl shadow-slate-400/30'
            }`}
          >
            {/* Header: App Name and Dismiss */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className={`w-4 h-4 rounded flex items-center justify-center text-white ${iconBg}`}>
                  <Icon className="w-2.5 h-2.5" />
                </div>
                <span className="text-[11px] font-semibold tracking-tight text-slate-500 dark:text-slate-400">
                  {toast.type === 'telegram'
                    ? 'WinMail Telegram Dispatch'
                    : toast.type === 'error'
                    ? 'WinMail Alert'
                    : 'Microsoft Graph • New Mail'}
                </span>
              </div>
              <button
                id={`toast-dismiss-${toast.id}`}
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Title / Subject */}
            <h4 className="text-xs font-bold leading-snug line-clamp-1 mb-1">
              {toast.title}
            </h4>

            {/* Sender / Account */}
            {toast.sender && (
              <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 line-clamp-1 mb-1">
                From: {toast.sender}
              </p>
            )}

            {/* Body preview */}
            <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mb-2 leading-relaxed">
              {toast.preview}
            </p>

            {/* Bottom Action Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800/50 text-[10px]">
              <span className="text-slate-400">
                {toast.accountEmail || 'Windows 11 Notification'}
              </span>
              {toast.messageId && onOpenMessage && (
                <button
                  id={`toast-open-${toast.id}`}
                  onClick={() => {
                    onOpenMessage(toast.messageId!, toast.accountEmail);
                    onDismiss(toast.id);
                  }}
                  className="flex items-center space-x-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
                >
                  <span>Open Email</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
