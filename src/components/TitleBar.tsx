import React, { useState, useEffect } from 'react';
import {
  Mail,
  Minus,
  Square,
  X,
  Volume2,
  VolumeX,
  Maximize2,
  RotateCw,
  Radio,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { SyncSettings, TelegramSettings } from '../types';

interface TitleBarProps {
  syncSettings: SyncSettings;
  telegramSettings: TelegramSettings;
  isChecking: boolean;
  onManualSync: () => void;
  onToggleSound: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  density: 'compact' | 'ultra' | 'normal';
  onCycleDensity: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  syncSettings,
  telegramSettings,
  isChecking,
  onManualSync,
  onToggleSound,
  darkMode,
  onToggleDarkMode,
  density,
  onCycleDensity
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const getDensityLabel = () => {
    if (density === 'ultra') return 'Mini (85%)';
    if (density === 'compact') return 'Compact (92%)';
    return 'Normal (100%)';
  };

  return (
    <header
      id="win11-titlebar"
      className={`h-9 select-none flex items-center justify-between px-3 border-b text-[11px] transition-colors duration-200 shrink-0 ${
        darkMode
          ? 'bg-slate-950/90 border-slate-800/80 text-slate-300 backdrop-blur-xl'
          : 'bg-slate-100/95 border-slate-200/90 text-slate-700 backdrop-blur-xl'
      }`}
    >
      {/* Left: App Identity */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center justify-center w-4.5 h-4.5 rounded bg-blue-600 text-white shadow-xs">
          <Mail className="w-3 h-3" />
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="font-bold tracking-tight text-slate-900 dark:text-slate-100 text-xs">
            WinMail
          </span>
          <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Fluent Pro
          </span>
        </div>
      </div>

      {/* Center: Live Sync & Status Indicator */}
      <div className="flex items-center space-x-2">
        <button
          id="btn-quick-sync"
          onClick={onManualSync}
          disabled={isChecking}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
            isChecking
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : darkMode
              ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
          }`}
          title="Trigger immediate mail sync across all accounts"
        >
          <RotateCw className={`w-2.5 h-2.5 ${isChecking ? 'animate-spin text-blue-500' : ''}`} />
          <span>{isChecking ? 'Syncing...' : 'Sync Fleet'}</span>
        </button>

        {syncSettings.autoSyncEnabled ? (
          <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>{syncSettings.intervalSeconds}s</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px]">
            <Radio className="w-2 h-2" />
            <span>Paused</span>
          </div>
        )}

        {telegramSettings.botStatus === 'valid' && (
          <div className="hidden sm:flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 text-[9px]">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            <span>TG Bot</span>
          </div>
        )}
      </div>

      {/* Right: Tools & Window Controls */}
      <div className="flex items-center space-x-1">
        {/* Scale/Density Toggle */}
        <button
          id="btn-toggle-density"
          onClick={onCycleDensity}
          className="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 transition"
          title={`Click to switch UI scale. Currently: ${getDensityLabel()}`}
        >
          {density === 'ultra' ? <ZoomOut className="w-2.5 h-2.5 text-blue-400" /> : <ZoomIn className="w-2.5 h-2.5" />}
          <span>{getDensityLabel()}</span>
        </button>

        <span className="hidden lg:inline-block font-mono text-[10px] text-slate-400 dark:text-slate-500 mx-1">
          {timeStr}
        </span>

        {/* Audio Toggle */}
        <button
          id="btn-toggle-sound"
          onClick={onToggleSound}
          className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
            syncSettings.soundEnabled ? 'text-blue-500' : 'text-slate-400'
          }`}
          title={syncSettings.soundEnabled ? 'Sound alerts enabled' : 'Sound alerts muted'}
        >
          {syncSettings.soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
        </button>

        {/* Theme Toggle */}
        <button
          id="btn-toggle-theme"
          onClick={onToggleDarkMode}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
          title="Toggle Dark/Light Mode"
        >
          {darkMode ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3 text-slate-600" />}
        </button>

        {/* Windows 11 Native Style Window Controls */}
        <div className="flex items-center ml-1 border-l border-slate-300 dark:border-slate-800 pl-1">
          <button
            id="win-btn-minimize"
            className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400"
            title="Minimize"
          >
            <Minus className="w-2.5 h-2.5" />
          </button>
          <button
            id="win-btn-maximize"
            onClick={handleFullscreenToggle}
            className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400"
            title={isFullscreen ? 'Restore' : 'Maximize'}
          >
            {isFullscreen ? <Maximize2 className="w-2.5 h-2.5" /> : <Square className="w-2 h-2" />}
          </button>
          <button
            id="win-btn-close"
            onClick={() => window.location.reload()}
            className="w-6 h-6 flex items-center justify-center hover:bg-red-500 hover:text-white rounded text-slate-500 dark:text-slate-400 transition-colors"
            title="Close / Reload"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
