import React, { useState, useEffect, useRef } from 'react';
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
  ZoomOut,
  ChevronDown,
  Zap,
  Clock,
  Play,
  Pause,
  Check,
  Send,
  Bell
} from 'lucide-react';
import { SyncSettings, TelegramSettings } from '../types';
import { playSoftClick } from '../utils/audio';

interface TitleBarProps {
  syncSettings: SyncSettings;
  telegramSettings: TelegramSettings;
  isChecking: boolean;
  countdown: number;
  onRefresh: () => void;
  onSetCooldownInterval: (seconds: number) => void;
  onToggleAutoSync: () => void;
  onToggleSound: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  density: 'compact' | 'ultra' | 'normal';
  onCycleDensity: () => void;
}

const PRESET_COOLDOWNS = [
  { label: '5s (Turbo)', value: 5 },
  { label: '10s (Fast)', value: 10 },
  { label: '15s (Quick)', value: 15 },
  { label: '30s (Recommended)', value: 30 },
  { label: '60s (1 min)', value: 60 },
  { label: '120s (2 min)', value: 120 },
  { label: '300s (5 min)', value: 300 },
  { label: '600s (10 min)', value: 600 }
];

export const TitleBar: React.FC<TitleBarProps> = ({
  syncSettings,
  telegramSettings,
  isChecking,
  countdown,
  onRefresh,
  onSetCooldownInterval,
  onToggleAutoSync,
  onToggleSound,
  darkMode,
  onToggleDarkMode,
  density,
  onCycleDensity
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isCooldownDropdownOpen, setIsCooldownDropdownOpen] = useState<boolean>(false);
  const [customCooldownInput, setCustomCooldownInput] = useState<string>('');
  const [isRefreshingAnimation, setIsRefreshingAnimation] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCooldownDropdownOpen(false);
      }
    };
    if (isCooldownDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCooldownDropdownOpen]);

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

  const handleSelectCooldown = (seconds: number) => {
    playSoftClick();
    onSetCooldownInterval(seconds);
    setIsCooldownDropdownOpen(false);
  };

  const handleApplyCustomCooldown = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customCooldownInput, 10);
    if (!isNaN(parsed) && parsed >= 3 && parsed <= 3600) {
      handleSelectCooldown(parsed);
      setCustomCooldownInput('');
    }
  };

  const handleInstantRefresh = () => {
    setIsRefreshingAnimation(true);
    playSoftClick();
    onRefresh();
    setTimeout(() => {
      setIsRefreshingAnimation(false);
    }, 1200);
  };

  const handlePushButtonToggle = () => {
    playSoftClick();
    onToggleAutoSync();
  };

  // Calculate progress percentage of current cooldown
  const totalInterval = syncSettings.intervalSeconds || 60;
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((totalInterval - countdown) / totalInterval) * 100))
  );

  const isAutoRunning = syncSettings.autoSyncEnabled;

  return (
    <header
      id="win11-titlebar"
      className={`h-9 select-none flex items-center justify-between px-3 border-b text-[11px] transition-colors duration-200 shrink-0 relative z-50 ${
        darkMode
          ? 'bg-slate-950/90 border-slate-800/80 text-slate-300 backdrop-blur-xl'
          : 'bg-slate-100/95 border-slate-200/90 text-slate-700 backdrop-blur-xl'
      }`}
    >
      {/* Left: App Identity */}
      <div className="flex items-center space-x-2 shrink-0">
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

      {/* Center: Sleek Unified Control Bar (Refresh, Push/Pause Toggle, Cooldown & Dropdown) */}
      <div className="flex items-center space-x-1.5">
        {/* Sleek Instant Mail Check Refresh Button */}
        <button
          id="btn-top-refresh"
          onClick={handleInstantRefresh}
          disabled={isChecking}
          className={`flex items-center space-x-1 px-2 py-0.5 h-6 rounded text-[10px] font-medium transition-all cursor-pointer ${
            isChecking || isRefreshingAnimation
              ? 'bg-blue-600 text-white shadow-xs'
              : darkMode
              ? 'bg-slate-800/80 hover:bg-slate-700/80 text-blue-400 border border-slate-700/60 hover:text-blue-300'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs hover:text-blue-600'
          }`}
          title="Instant Mail Check across all accounts"
        >
          <RotateCw
            className={`w-2.5 h-2.5 ${
              isChecking || isRefreshingAnimation ? 'animate-spin text-blue-400' : 'text-blue-500'
            }`}
          />
          <span>{isChecking || isRefreshingAnimation ? 'Checking...' : 'Refresh'}</span>
        </button>

        {/* Sleek Unified Auto-Checking & Cooldown Control */}
        <div
          className={`flex items-center h-6 rounded border transition-all ${
            isAutoRunning
              ? darkMode
                ? 'bg-slate-900/90 border-emerald-500/40 text-emerald-300'
                : 'bg-emerald-50/80 border-emerald-300 text-emerald-800 shadow-2xs'
              : darkMode
              ? 'bg-slate-900/90 border-amber-500/40 text-amber-300'
              : 'bg-amber-50/80 border-amber-300 text-amber-800 shadow-2xs'
          }`}
        >
          {/* Push / Pause Toggle Mini Button */}
          <button
            id="btn-top-push-pause"
            onClick={handlePushButtonToggle}
            className={`flex items-center space-x-1 px-1.5 h-full text-[10px] font-semibold transition cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${
              !isAutoRunning
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
            title={
              isAutoRunning
                ? 'Auto-checking is ACTIVE. Click Push to Pause.'
                : 'Auto-checking is PAUSED (PUSHED). Click to Resume.'
            }
          >
            {!isAutoRunning ? (
              <>
                <Play className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                <span className="text-[9.5px]">Paused</span>
              </>
            ) : (
              <>
                <Pause className="w-2.5 h-2.5 text-emerald-500" />
                <span className="text-[9.5px]">Push</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div
            className={`w-px h-3.5 ${
              isAutoRunning
                ? darkMode ? 'bg-emerald-500/30' : 'bg-emerald-200'
                : darkMode ? 'bg-amber-500/30' : 'bg-amber-200'
            }`}
          />

          {/* Running Cooldown Display */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center">
              <button
                id="btn-cooldown-timer-display"
                onClick={() => setIsCooldownDropdownOpen(!isCooldownDropdownOpen)}
                className="flex items-center space-x-1 px-1.5 h-full text-[10px] font-mono cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition"
                title="Click to change auto-sync interval"
              >
                {isAutoRunning ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="font-semibold">{countdown}s</span>
                    <span className="opacity-50 text-[9px]">/{syncSettings.intervalSeconds}s</span>
                  </>
                ) : (
                  <span className="text-[9.5px] opacity-75 font-sans">Off</span>
                )}
              </button>

              {/* Dropdown Chevron '⌄' button */}
              <button
                id="btn-cooldown-dropdown-toggle"
                onClick={() => setIsCooldownDropdownOpen(!isCooldownDropdownOpen)}
                className="px-1 h-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer text-slate-400 hover:text-slate-200"
                title="Choose Cooldown Interval"
              >
                <ChevronDown
                  className={`w-2.5 h-2.5 transition-transform duration-200 ${
                    isCooldownDropdownOpen ? 'rotate-180 text-blue-500' : ''
                  }`}
                />
              </button>
            </div>

            {/* Cooldown Interval Dropdown Popover */}
            {isCooldownDropdownOpen && (
              <div
                id="cooldown-dropdown-popover"
                className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-56 rounded-lg border shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                  darkMode
                    ? 'bg-slate-900 border-slate-700 text-slate-200 shadow-slate-950/80'
                    : 'bg-white border-slate-200 text-slate-800 shadow-slate-300/60'
                }`}
              >
                {/* Dropdown Header & Auto-Checking Toggle */}
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Sync Cooldown
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      playSoftClick();
                      onToggleAutoSync();
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center space-x-1 transition cursor-pointer ${
                      isAutoRunning
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {isAutoRunning ? (
                      <>
                        <Play className="w-2 h-2 fill-emerald-500" />
                        <span>Running</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-2 h-2 fill-amber-500" />
                        <span>Paused</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mb-2 px-1">
                  <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                    <span>Current cycle</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {isAutoRunning ? `${countdown}s left` : 'Paused'}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ease-linear ${
                        isAutoRunning
                          ? 'bg-gradient-to-r from-blue-500 to-emerald-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: isAutoRunning ? `${progressPercent}%` : '0%' }}
                    />
                  </div>
                </div>

                {/* Available Cooldown Times List */}
                <div className="space-y-0.5 max-h-44 overflow-y-auto pr-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 block mb-0.5">
                    Available Times
                  </span>
                  {PRESET_COOLDOWNS.map((preset) => {
                    const isSelected = syncSettings.intervalSeconds === preset.value;
                    return (
                      <button
                        key={preset.value}
                        onClick={() => handleSelectCooldown(preset.value)}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded text-[10px] font-medium transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>{preset.label}</span>
                        {isSelected ? (
                          <Check className="w-2.5 h-2.5 text-white" />
                        ) : (
                          <span className="text-[8.5px] opacity-60 font-mono">{preset.value}s</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Interval Input */}
                <form
                  onSubmit={handleApplyCustomCooldown}
                  className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center space-x-1"
                >
                  <input
                    type="number"
                    min="3"
                    max="3600"
                    placeholder="Custom sec..."
                    value={customCooldownInput}
                    onChange={(e) => setCustomCooldownInput(e.target.value)}
                    className={`w-full px-1.5 py-0.5 text-[9.5px] rounded border transition ${
                      darkMode
                        ? 'bg-slate-950 border-slate-700 text-slate-200 placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!customCooldownInput}
                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[9.5px] transition disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    Set
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Telegram Bot Badge */}
        {telegramSettings.botStatus === 'valid' && (
          <div className="hidden md:flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 text-[9px]">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            <span>TG Bot</span>
          </div>
        )}
      </div>

      {/* Right: Tools & Window Controls */}
      <div className="flex items-center space-x-1 shrink-0">
        {/* Scale/Density Toggle */}
        <button
          id="btn-toggle-density"
          onClick={onCycleDensity}
          className="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
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
          className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer ${
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
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer"
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
            className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 cursor-pointer"
            title={isFullscreen ? 'Restore' : 'Maximize'}
          >
            {isFullscreen ? <Maximize2 className="w-2.5 h-2.5" /> : <Square className="w-2 h-2" />}
          </button>
          <button
            id="win-btn-close"
            onClick={() => window.location.reload()}
            className="w-6 h-6 flex items-center justify-center hover:bg-red-500 hover:text-white rounded text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            title="Close / Reload"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
