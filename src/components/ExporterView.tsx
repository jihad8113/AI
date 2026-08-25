import React, { useState, useEffect } from 'react';
import {
  FileCode2,
  Download,
  Copy,
  Check,
  Terminal,
  Layers,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Laptop,
  FolderArchive,
  PlayCircle,
  FileText,
  AlertCircle,
  Cpu,
  PackageCheck,
  Globe,
  KeyRound
} from 'lucide-react';
import JSZip from 'jszip';
import { MailAccount, TelegramSettings } from '../types';
import {
  generatePythonScript,
  generateWindowsBatchFile,
  generateExeBuilderBatchFile,
  generatePowerShellScript,
  generateAccountsText,
  generateStandaloneHtmlFile
} from '../utils/scriptGenerators';
import { fetchStaticPaData } from '../utils/apiService';
import { playSoftClick, playWindowsNotificationSound } from '../utils/audio';

interface ExporterViewProps {
  accounts: MailAccount[];
  telegramSettings: TelegramSettings;
  darkMode: boolean;
  addToast: (toast: any) => void;
}

export const ExporterView: React.FC<ExporterViewProps> = ({
  accounts,
  telegramSettings,
  darkMode,
  addToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'html' | 'exe_bat' | 'python' | 'bat' | 'ps1' | 'accounts' | 'stp' | 'readme'>('html');
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [staticPassword, setStaticPassword] = useState('S-and-T@7-2026');

  useEffect(() => {
    fetchStaticPaData().then((res) => {
      if (res.ok && res.password) {
        setStaticPassword(res.password);
      }
    });
  }, []);

  const htmlCode = generateStandaloneHtmlFile(accounts, telegramSettings);
  const pythonCode = generatePythonScript(accounts, telegramSettings);
  const exeBatCode = generateExeBuilderBatchFile();
  const batCode = generateWindowsBatchFile();
  const ps1Code = generatePowerShellScript();
  const accountsText = generateAccountsText(accounts);
  const cleanEmails = accounts.map((a) => a.email.trim()).filter(Boolean);
  const stpText = cleanEmails.length > 0 
    ? `${cleanEmails.join('\n')}\n${staticPassword}\n` 
    : `${staticPassword}\n`;

  const readmeText = `===================================================================
     WINMAIL CONTROLLER & TELEGRAM BOT - QUICK START
===================================================================

Thank you for downloading the WinMail Package!

📁 INCLUDED FILES IN THIS PACKAGE:
  1. WinMail_Web_Controller.html -> 1-FILE STANDALONE WEB APP (Double-click in any browser on PC or Android phone!)
  2. build_winmail_exe.bat       -> Compiles bot.py into a standalone WinMail_Bot.exe (Windows 11)
  3. launch_bot.bat              -> Direct 1-click Python runner for Windows 11
  4. launch_bot.ps1              -> Windows 11 PowerShell alternative runner
  5. bot.py                      -> Full Python Telegram Bot engine (Graph API sync)
  6. accounts.txt                -> Your configured mail accounts (mail|pass|token|id)
  7. README.txt                  -> This guide

-------------------------------------------------------------------
🚀 OPTION 1: 1-FILE STANDALONE WEB APP (.HTML) - ZERO INSTALLATION!
-------------------------------------------------------------------
- Just double-click "WinMail_Web_Controller.html" in Chrome, Edge, Safari, or on Android!
- Zero Python or software installation required.
- Directly connects to Microsoft Graph API, reads mail inboxes, and sends live Telegram alerts.

-------------------------------------------------------------------
🚀 OPTION 2: COMPILE TO STANDALONE WINDOWS 11 .EXE
-------------------------------------------------------------------
Step 1: Extract this ZIP file on Windows 11.
Step 2: Double-click "build_winmail_exe.bat" to create "dist\\WinMail_Bot.exe".

-------------------------------------------------------------------
🚀 OPTION 3: RUN DIRECTLY WITH PYTHON
-------------------------------------------------------------------
Double-click "launch_bot.bat" to monitor inboxes 24/7.
===================================================================
`;

  let currentContent = htmlCode;
  let currentFilename = 'WinMail_Web_Controller.html';
  let currentMime = 'text/html';

  if (activeSubTab === 'html') {
    currentContent = htmlCode;
    currentFilename = 'WinMail_Web_Controller.html';
    currentMime = 'text/html';
  } else if (activeSubTab === 'exe_bat') {
    currentContent = exeBatCode;
    currentFilename = 'build_winmail_exe.bat';
    currentMime = 'text/plain';
  } else if (activeSubTab === 'python') {
    currentContent = pythonCode;
    currentFilename = 'bot.py';
    currentMime = 'text/x-python';
  } else if (activeSubTab === 'bat') {
    currentContent = batCode;
    currentFilename = 'launch_bot.bat';
    currentMime = 'text/plain';
  } else if (activeSubTab === 'ps1') {
    currentContent = ps1Code;
    currentFilename = 'launch_bot.ps1';
    currentMime = 'text/plain';
  } else if (activeSubTab === 'accounts') {
    currentContent = accountsText;
    currentFilename = 'accounts.txt';
    currentMime = 'text/plain';
  } else if (activeSubTab === 'stp') {
    currentContent = stpText;
    currentFilename = 'STP.txt';
    currentMime = 'text/plain';
  } else if (activeSubTab === 'readme') {
    currentContent = readmeText;
    currentFilename = 'README.txt';
    currentMime = 'text/plain';
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    playSoftClick();
    addToast({
      id: Date.now().toString(),
      title: 'Copied to Clipboard',
      preview: `Copied ${currentFilename} content.`,
      type: 'system'
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([currentContent], { type: `${currentMime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilename;
    a.click();
    URL.revokeObjectURL(url);
    playSoftClick();
    addToast({
      id: Date.now().toString(),
      title: 'File Downloaded',
      preview: `Saved ${currentFilename} to your device.`,
      type: 'system'
    });
  };

  const handleDownloadHtmlDirect = () => {
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'WinMail_Web_Controller.html';
    a.click();
    URL.revokeObjectURL(url);
    playWindowsNotificationSound();
    addToast({
      id: Date.now().toString(),
      title: 'HTML File Downloaded!',
      preview: 'You can open WinMail_Web_Controller.html directly in any browser on phone or PC.',
      type: 'system'
    });
  };

  const handleDownloadCompleteZip = async () => {
    try {
      setZipping(true);
      playSoftClick();

      const zip = new JSZip();
      const folder = zip.folder('WinMail_Suite') || zip;

      folder.file('WinMail_Web_Controller.html', htmlCode);
      folder.file('build_winmail_exe.bat', exeBatCode);
      folder.file('launch_bot.bat', batCode);
      folder.file('launch_bot.ps1', ps1Code);
      folder.file('bot.py', pythonCode);
      folder.file('accounts.txt', accountsText);
      folder.file('STP.txt', stpText);
      folder.file('README.txt', readmeText);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WinMail_Suite_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      playWindowsNotificationSound();
      addToast({
        id: Date.now().toString(),
        title: 'Complete Suite Downloaded',
        preview: 'Extracted files include WinMail_Web_Controller.html, EXE builder, and scripts.',
        type: 'system'
      });
    } catch (err: any) {
      console.error('ZIP generation error:', err);
      alert('Could not generate ZIP bundle. You can download individual files.');
    } finally {
      setZipping(false);
    }
  };

  return (
    <div id="exporter-view" className="flex-1 flex flex-col h-full overflow-hidden p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            <span>Standalone Web (.HTML) & Windows Suite</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Download as a 1-file self-contained <code className="font-mono text-emerald-600 dark:text-emerald-400">.html</code> web app (no install) or Windows 11 EXE builder.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Master 1-Click HTML Download */}
          <button
            id="btn-download-html-hero"
            onClick={handleDownloadHtmlDirect}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition transform active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download .HTML Web App</span>
          </button>

          {/* Master 1-Click ZIP Download Button */}
          <button
            id="btn-download-complete-zip"
            onClick={handleDownloadCompleteZip}
            disabled={zipping}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition transform active:scale-95 disabled:opacity-50"
          >
            <FolderArchive className="w-4 h-4" />
            <span>{zipping ? 'Packaging...' : 'Download ZIP Suite (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* Standalone HTML Spotlight Banner */}
      <div
        className={`p-4 rounded-2xl border transition-all shadow-md ${
          darkMode
            ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-blue-950/30 border-emerald-800/40'
            : 'bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white border-emerald-200'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  1-File Standalone Web Controller (.HTML)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                  Zero Installation • Runs On Android & PC
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                A single <b>.html</b> file that runs completely in your web browser (Chrome, Edge, Safari, Android). It directly connects to Microsoft Graph API to read your inboxes, check emails, and send live Telegram alerts. No Python, compiler, or software needed!
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
            <button
              onClick={handleDownloadHtmlDirect}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Download className="w-4 h-4" />
              <span>Download WinMail.html</span>
            </button>
          </div>
        </div>
      </div>

      {/* Script Tabs & Code Viewer */}
      <div
        className={`flex-1 rounded-xl border flex flex-col overflow-hidden ${
          darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        } shadow-lg`}
      >
        {/* Sub-tab switcher toolbar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <button
              id="tab-html-web"
              onClick={() => setActiveSubTab('html')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubTab === 'html'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>WinMail_Web_Controller.html (.HTML)</span>
            </button>

            <button
              id="tab-exe-builder"
              onClick={() => setActiveSubTab('exe_bat')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubTab === 'exe_bat'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>build_winmail_exe.bat (EXE Builder)</span>
            </button>

            <button
              id="tab-bot-python"
              onClick={() => setActiveSubTab('python')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubTab === 'python'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>bot.py (Python Engine)</span>
            </button>

            <button
              id="tab-launch-bat"
              onClick={() => setActiveSubTab('bat')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubTab === 'bat'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>launch_bot.bat</span>
            </button>

            <button
              id="tab-accounts-txt"
              onClick={() => setActiveSubTab('accounts')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubTab === 'accounts'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>accounts.txt ({accounts.length})</span>
            </button>

            <button
              id="tab-stp-txt"
              onClick={() => setActiveSubTab('stp')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubTab === 'stp'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>STP.txt (Static PA)</span>
            </button>

            <button
              id="tab-readme-txt"
              onClick={() => setActiveSubTab('readme')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubTab === 'readme'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>README.txt</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="btn-copy-code"
              onClick={handleCopy}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>

            <button
              id="btn-download-single"
              onClick={handleDownloadSingle}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {currentFilename}</span>
            </button>
          </div>
        </div>

        {/* Code Content Container */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed bg-slate-950 text-slate-200 select-text">
          <pre className="whitespace-pre">{currentContent}</pre>
        </div>
      </div>
    </div>
  );
};
