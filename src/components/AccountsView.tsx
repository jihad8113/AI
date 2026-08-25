import React, { useState } from 'react';
import {
  Users,
  Plus,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Edit2,
  Copy,
  ExternalLink,
  Search,
  Key,
  KeyRound,
  Shield,
  Download,
  Upload,
  Eye,
  EyeOff,
  Inbox,
  Zap,
  Check,
  Sparkles,
  Lock
} from 'lucide-react';
import { MailAccount, ViewTab } from '../types';
import { refreshMicrosoftToken, fetchInboxMessages, syncFleetEmailsToStaticPa } from '../utils/apiService';
import { loadStaticPaPassword } from '../utils/storage';
import { generateAccountsText } from '../utils/scriptGenerators';
import {
  parseAccountString,
  parseMultipleAccountStrings,
  convertParsedToMailAccount,
  ParsedAccountResult
} from '../utils/accountParser';
import { playSoftClick, playWindowsNotificationSound } from '../utils/audio';
import { copyToClipboard } from '../utils/clipboard';
import { ClickableEmail } from '../utils/clickableCodes';
import { StaticPaModal } from './StaticPaModal';

interface AccountsViewProps {
  accounts: MailAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<MailAccount[]>>;
  onOpenInboxForAccount: (email: string) => void;
  darkMode: boolean;
  addToast: (toast: any) => void;
  addLog: (type: any, message: string, details?: string, accountEmail?: string) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  setAccounts,
  onOpenInboxForAccount,
  darkMode,
  addToast,
  addLog
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isStaticPaModalOpen, setIsStaticPaModalOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [autoVerifyOnBulk, setAutoVerifyOnBulk] = useState(true);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  // Quick String Input State
  const [quickString, setQuickString] = useState('');
  const [quickConnecting, setQuickConnecting] = useState(false);
  const [showQuickPassword, setShowQuickPassword] = useState(false);

  // Single Account Form State
  const [modalQuickPaste, setModalQuickPaste] = useState('');
  const [modalAutoFilled, setModalAutoFilled] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRefreshToken, setFormRefreshToken] = useState('');
  const [formClientId, setFormClientId] = useState('d3590ed6-52b3-4102-aeff-aad2292ab01c');
  const [formClientSecret, setFormClientSecret] = useState('');
  const [formUserId, setFormUserId] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formColor, setFormColor] = useState('#0078D4');
  const [showPassword, setShowPassword] = useState(false);
  const [testingSingle, setTestingSingle] = useState(false);

  // Bulk & Single Delete Confirmation Modals (in-app, avoiding iframe confirm() block)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [singleDeleteAccount, setSingleDeleteAccount] = useState<{ id: string; email: string } | null>(null);

  // Batch Testing State
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [testProgress, setTestProgress] = useState({ current: 0, total: 0 });

  // Track copied indicator { [key: string]: boolean }
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
    } else {
      addToast({
        id: Date.now().toString(),
        title: 'Copy Error',
        preview: 'Failed to copy to clipboard.',
        type: 'error'
      });
    }
  };

  // Parse quick input in real-time
  const parsedQuickResult: ParsedAccountResult = parseAccountString(quickString);
  const quickLines = quickString.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const isMultiLineQuick = quickLines.length > 1;

  const filteredAccounts = accounts.filter((acc) => {
    const matchSearch =
      acc.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (acc.label && acc.label.toLowerCase().includes(searchTerm.toLowerCase())) ||
      acc.clientId.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (filterStatus === 'all') return true;
    if (filterStatus === 'connected') return acc.status === 'connected';
    if (filterStatus === 'error') return acc.status === 'error' || acc.status === 'expired_token';
    return true;
  });

  const handleOpenAdd = () => {
    setEditingAccountId(null);
    setModalQuickPaste('');
    setModalAutoFilled(false);
    setFormEmail('');
    setFormPassword('');
    setFormRefreshToken('');
    setFormClientId('d3590ed6-52b3-4102-aeff-aad2292ab01c');
    setFormClientSecret('');
    setFormUserId('');
    setFormLabel('');
    setFormColor('#0078D4');
    setIsSingleModalOpen(true);
  };

  const handleOpenEdit = (acc: MailAccount) => {
    setEditingAccountId(acc.id);
    setModalQuickPaste('');
    setModalAutoFilled(false);
    setFormEmail(acc.email);
    setFormPassword(acc.password || '');
    setFormRefreshToken(acc.refreshToken);
    setFormClientId(acc.clientId);
    setFormClientSecret(acc.clientSecret || '');
    setFormUserId(acc.userId || '');
    setFormLabel(acc.label || '');
    setFormColor(acc.color || '#0078D4');
    setIsSingleModalOpen(true);
  };

  // Handle auto-fill in modal when pasting full string
  const handleModalQuickPasteChange = (val: string) => {
    setModalQuickPaste(val);
    if (!val.trim()) {
      setModalAutoFilled(false);
      return;
    }
    const parsed = parseAccountString(val);
    if (parsed.email) setFormEmail(parsed.email);
    if (parsed.password) setFormPassword(parsed.password);
    if (parsed.refreshToken) setFormRefreshToken(parsed.refreshToken);
    if (parsed.clientId) setFormClientId(parsed.clientId);
    if (parsed.userId) setFormUserId(parsed.userId);
    if (parsed.clientSecret) setFormClientSecret(parsed.clientSecret);
    if (parsed.email && !formLabel) {
      setFormLabel(parsed.email.split('@')[0] || 'Outlook Account');
    }
    setModalAutoFilled(parsed.isValid);
  };

  // Quick Add / Auto-Connect Handler from the top bar
  const handleQuickAutoConnect = async (shouldAutoFetch = true) => {
    if (isMultiLineQuick) {
      handleProcessMultiLineQuick();
      return;
    }

    if (!parsedQuickResult.isValid || !parsedQuickResult.email) {
      alert('Please provide a valid account string containing email and refresh token.');
      return;
    }

    const { email, password, refreshToken, clientId, userId, clientSecret } = parsedQuickResult;

    // Check if account already exists
    const existingIndex = accounts.findIndex((a) => a.email.toLowerCase() === email.toLowerCase());

    setQuickConnecting(true);
    playSoftClick();

    addToast({
      id: Date.now().toString(),
      title: 'Connecting to Microsoft...',
      preview: `Acquiring Graph token for ${email}`,
      type: 'system'
    });

    // 1. Refresh & Validate Microsoft Token
    const tokenResult = await refreshMicrosoftToken(clientId, refreshToken, clientSecret);

    if (tokenResult.error) {
      setQuickConnecting(false);
      const failedAccount: MailAccount = {
        id: existingIndex >= 0 ? accounts[existingIndex].id : `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        email,
        password: password || '',
        refreshToken,
        clientId,
        userId: userId || '',
        status: 'expired_token',
        lastError: tokenResult.error,
        lastChecked: new Date().toISOString(),
        label: email.split('@')[0] || 'Outlook Account',
        color: '#0078D4',
        messages: []
      };

      if (existingIndex >= 0) {
        setAccounts((prev) => prev.map((a, i) => (i === existingIndex ? failedAccount : a)));
      } else {
        setAccounts((prev) => [failedAccount, ...prev]);
      }

      addToast({
        id: Date.now().toString(),
        title: 'Token Error',
        preview: `Failed to authenticate ${email}: ${tokenResult.error}`,
        type: 'error'
      });
      addLog('error', `Quick connect failed for ${email}`, tokenResult.error, email);
      return;
    }

    // 2. Fetch Initial Inbox Messages if requested
    let messages: any[] = [];
    let inboxError: string | undefined;

    if (shouldAutoFetch) {
      const tempAcc: MailAccount = {
        id: 'temp',
        email,
        refreshToken: tokenResult.newRefreshToken || refreshToken,
        clientId,
        accessToken: tokenResult.accessToken,
        userId: userId || '',
        status: 'connected',
        messages: []
      };
      const inboxRes = await fetchInboxMessages(tempAcc, { limit: 15 });
      if (inboxRes.error) {
        inboxError = inboxRes.error;
      } else {
        messages = inboxRes.messages || [];
      }
    }

    setQuickConnecting(false);

    const connectedAccount: MailAccount = {
      id: existingIndex >= 0 ? accounts[existingIndex].id : `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email,
      password: password || '',
      refreshToken: tokenResult.newRefreshToken || refreshToken,
      clientId,
      clientSecret,
      userId: userId || '',
      status: inboxError ? 'error' : 'connected',
      lastError: inboxError,
      accessToken: tokenResult.accessToken,
      lastChecked: new Date().toISOString(),
      label: email.split('@')[0] || 'Outlook Account',
      color: '#0078D4',
      messages
    };

    let updatedAccounts: MailAccount[];
    if (existingIndex >= 0) {
      updatedAccounts = accounts.map((a, i) => (i === existingIndex ? connectedAccount : a));
    } else {
      updatedAccounts = [connectedAccount, ...accounts];
    }
    setAccounts(updatedAccounts);
    // Explicit instant sync to STP.txt on disk
    syncFleetEmailsToStaticPa(
      updatedAccounts.map((a) => a.email.trim()).filter(Boolean),
      loadStaticPaPassword()
    );

    playWindowsNotificationSound();
    addToast({
      id: Date.now().toString(),
      title: 'Account Connected Successfully!',
      preview: `${email} is active. Synced ${messages.length} inbox messages.`,
      type: 'system'
    });
    addLog(
      'success',
      `Auto-connected account ${email}`,
      `Token verified and loaded ${messages.length} messages.`,
      email
    );

    // Reset input
    setQuickString('');
  };

  // Bulk quick add if multi-line is detected
  const handleProcessMultiLineQuick = async () => {
    const parsedList = parseMultipleAccountStrings(quickString);
    if (parsedList.length === 0) {
      alert('No valid account entries found in input.');
      return;
    }

    setQuickConnecting(true);
    const newAccounts: MailAccount[] = [];

    for (const item of parsedList) {
      const exists = accounts.some((a) => a.email.toLowerCase() === item.email.toLowerCase());
      if (!exists) {
        newAccounts.push(convertParsedToMailAccount(item));
      }
    }

    if (newAccounts.length === 0) {
      alert('All accounts already exist in the list.');
      setQuickConnecting(false);
      return;
    }

    const allAccounts = [...newAccounts, ...accounts];
    setAccounts(allAccounts);
    // Explicit instant sync to STP.txt on disk
    syncFleetEmailsToStaticPa(
      allAccounts.map((a) => a.email.trim()).filter(Boolean),
      loadStaticPaPassword()
    );
    addToast({
      id: Date.now().toString(),
      title: 'Accounts Added',
      preview: `Added ${newAccounts.length} accounts from quick string.`,
      type: 'system'
    });
    addLog('info', `Imported ${newAccounts.length} accounts from quick input`);
    setQuickString('');
    setQuickConnecting(false);
  };

  const handleSaveSingleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formRefreshToken || !formClientId) {
      alert('Email, Refresh Token, and Client ID are required.');
      return;
    }

    setTestingSingle(true);
    const tokenResult = await refreshMicrosoftToken(formClientId, formRefreshToken, formClientSecret);
    setTestingSingle(false);

    const isSuccess = !tokenResult.error;

    if (editingAccountId) {
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === editingAccountId
            ? {
                ...acc,
                email: formEmail.trim(),
                password: formPassword,
                refreshToken: tokenResult.newRefreshToken || formRefreshToken.trim(),
                clientId: formClientId.trim(),
                clientSecret: formClientSecret.trim(),
                userId: formUserId.trim(),
                label: formLabel.trim(),
                color: formColor,
                status: isSuccess ? 'connected' : 'expired_token',
                lastError: tokenResult.error,
                accessToken: tokenResult.accessToken,
                lastChecked: new Date().toISOString()
              }
            : acc
        )
      );
      addToast({
        id: Date.now().toString(),
        title: 'Account Updated',
        preview: `Credentials updated for ${formEmail}. Status: ${isSuccess ? 'Connected' : 'Token Error'}`,
        type: isSuccess ? 'system' : 'error'
      });
      addLog(
        isSuccess ? 'success' : 'warning',
        `Updated account ${formEmail}`,
        tokenResult.error || 'Token verified successfully.',
        formEmail
      );
    } else {
      const newAcc: MailAccount = {
        id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        email: formEmail.trim(),
        password: formPassword,
        refreshToken: tokenResult.newRefreshToken || formRefreshToken.trim(),
        clientId: formClientId.trim(),
        clientSecret: formClientSecret.trim(),
        userId: formUserId.trim(),
        label: formLabel.trim() || 'Outlook Account',
        color: formColor,
        status: isSuccess ? 'connected' : 'expired_token',
        lastError: tokenResult.error,
        accessToken: tokenResult.accessToken,
        lastChecked: new Date().toISOString(),
        messages: []
      };
      const updated = [newAcc, ...accounts];
      setAccounts(updated);
      // Explicit instant sync to STP.txt on disk
      syncFleetEmailsToStaticPa(
        updated.map((a) => a.email.trim()).filter(Boolean),
        loadStaticPaPassword()
      );
      addToast({
        id: Date.now().toString(),
        title: 'Account Added',
        preview: `${formEmail} added. Status: ${isSuccess ? 'Connected' : 'Token Error'}`,
        type: isSuccess ? 'system' : 'error'
      });
      addLog(
        isSuccess ? 'success' : 'warning',
        `Added new account ${formEmail}`,
        tokenResult.error || 'Microsoft token verified.',
        formEmail
      );
    }

    setIsSingleModalOpen(false);
  };

  const handleProcessBulkImport = async () => {
    if (!bulkInput.trim()) return;

    const parsedList = parseMultipleAccountStrings(bulkInput);
    if (parsedList.length === 0) {
      alert('No valid account lines found. Format: email|password|refresh_token|client_id');
      return;
    }

    const addedAccounts: MailAccount[] = [];

    for (const parsed of parsedList) {
      const exists = accounts.some((a) => a.email.toLowerCase() === parsed.email.toLowerCase());
      if (!exists && parsed.email) {
        addedAccounts.push(convertParsedToMailAccount(parsed));
      }
    }

    if (addedAccounts.length > 0) {
      const allAccounts = [...addedAccounts, ...accounts];
      setAccounts(allAccounts);
      // Explicit instant sync to STP.txt on disk
      syncFleetEmailsToStaticPa(
        allAccounts.map((a) => a.email.trim()).filter(Boolean),
        loadStaticPaPassword()
      );
      addToast({
        id: Date.now().toString(),
        title: 'Bulk Import Success',
        preview: `Imported ${addedAccounts.length} accounts.`,
        type: 'system'
      });
      addLog('info', `Bulk imported ${addedAccounts.length} accounts`);
      setBulkInput('');
      setIsBulkModalOpen(false);

      if (autoVerifyOnBulk) {
        setTimeout(() => handleTestAllAccounts(), 500);
      }
    } else {
      alert('All accounts from the list already exist.');
    }
  };

  const handleTestAccount = async (account: MailAccount) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === account.id ? { ...a, status: 'fetching' } : a))
    );

    const tokenRes = await refreshMicrosoftToken(account.clientId, account.refreshToken, account.clientSecret);
    if (tokenRes.error) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id
            ? { ...a, status: 'expired_token', lastError: tokenRes.error }
            : a
        )
      );
      addToast({
        id: Date.now().toString(),
        title: 'Token Error',
        preview: `${account.email}: ${tokenRes.error}`,
        type: 'error'
      });
      addLog('error', `Token test failed for ${account.email}`, tokenRes.error, account.email);
      return;
    }

    const updatedAcc = {
      ...account,
      accessToken: tokenRes.accessToken,
      refreshToken: tokenRes.newRefreshToken || account.refreshToken
    };
    const inboxRes = await fetchInboxMessages(updatedAcc, { limit: 10 });

    if (inboxRes.error) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id
            ? {
                ...a,
                status: 'error',
                lastError: inboxRes.error,
                accessToken: tokenRes.accessToken,
                lastChecked: new Date().toISOString()
              }
            : a
        )
      );
      addLog('error', `Graph inbox fetch failed for ${account.email}`, inboxRes.error, account.email);
    } else {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id
            ? {
                ...a,
                status: 'connected',
                lastError: undefined,
                accessToken: tokenRes.accessToken,
                messages: inboxRes.messages || [],
                lastChecked: new Date().toISOString()
              }
            : a
        )
      );
      addToast({
        id: Date.now().toString(),
        title: 'Account Verified',
        preview: `${account.email}: Connected! Loaded ${inboxRes.messages?.length || 0} messages.`,
        type: 'system'
      });
      addLog(
        'success',
        `Verified ${account.email}`,
        `Retrieved ${inboxRes.messages?.length || 0} messages`,
        account.email
      );
    }
  };

  const handleTestAllAccounts = async () => {
    if (accounts.length === 0 || isTestingAll) return;

    setIsTestingAll(true);
    setTestProgress({ current: 0, total: accounts.length });
    addToast({
      id: Date.now().toString(),
      title: 'Batch Verification Started',
      preview: `Testing OAuth tokens for ${accounts.length} inboxes...`,
      type: 'system'
    });

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      setTestProgress({ current: i + 1, total: accounts.length });
      await handleTestAccount(acc);
      await new Promise((r) => setTimeout(r, 400));
    }

    setIsTestingAll(false);
    playWindowsNotificationSound();
    addToast({
      id: Date.now().toString(),
      title: 'Verification Complete',
      preview: `Completed testing ${accounts.length} inboxes.`,
      type: 'system'
    });
  };

  const handleDeleteAccount = (id: string, email: string) => {
    setSingleDeleteAccount({ id, email });
  };

  const executeDeleteSingle = () => {
    if (!singleDeleteAccount) return;
    const { id, email } = singleDeleteAccount;
    const remainingAccounts = accounts.filter((a) => a.id !== id);
    setAccounts(remainingAccounts);
    // Explicit instant sync to STP.txt on disk
    syncFleetEmailsToStaticPa(
      remainingAccounts.map((a) => a.email.trim()).filter(Boolean),
      loadStaticPaPassword()
    );
    setSingleDeleteAccount(null);
    playSoftClick();
    addToast({
      id: Date.now().toString(),
      title: 'Account Removed',
      preview: `${email} was deleted.`,
      type: 'system'
    });
    addLog('info', `Removed account ${email}`);
  };

  const handleBulkDeleteAccounts = () => {
    if (!accounts || accounts.length === 0) {
      playSoftClick();
      addToast({
        id: Date.now().toString(),
        title: 'No Account Found',
        preview: 'There are no mail accounts in the system to delete.',
        type: 'system'
      });
      return;
    }
    setBulkDeleteModalOpen(true);
  };

  const executeBulkDelete = () => {
    const count = accounts.length;
    setAccounts([]);
    // Explicit instant sync to STP.txt on disk (empty accounts, static pass preserved)
    syncFleetEmailsToStaticPa([], loadStaticPaPassword());
    setBulkDeleteModalOpen(false);
    playSoftClick();
    addToast({
      id: Date.now().toString(),
      title: 'All Accounts Deleted',
      preview: `Successfully removed all ${count} mail accounts (valid, bad & expired) and all data.`,
      type: 'system'
    });
    addLog('warning', `Bulk deleted all ${count} mail accounts.`);
  };

  const handleCopyLine = async (acc: MailAccount) => {
    const line = `${acc.email}|${acc.password || ''}|${acc.refreshToken}|${acc.clientId}${
      acc.userId ? `|${acc.userId}` : ''
    }`;
    await triggerCopy(`card-copy-${acc.id}`, line, `${acc.email} full combo string`);
  };

  const handleExportText = () => {
    const text = generateAccountsText(accounts);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({
      id: Date.now().toString(),
      title: 'Accounts Exported',
      preview: `Saved ${accounts.length} accounts to accounts.txt`,
      type: 'system'
    });
  };

  const totalConnected = accounts.filter((a) => a.status === 'connected').length;
  const totalErrors = accounts.filter((a) => a.status === 'error' || a.status === 'expired_token').length;

  return (
    <div id="accounts-view" className="flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-4 space-y-2.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
            <Users className="w-4 h-4 text-blue-500" />
            <span>Microsoft Accounts & Fleet</span>
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Manage multi-account OAuth2 tokens, inspect inbox health, and bulk copy credentials.
          </p>
        </div>

        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
          <button
            id="btn-bulk-delete"
            onClick={handleBulkDeleteAccounts}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md border border-red-300 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-[11px] font-semibold text-red-700 dark:text-red-300 shadow-2xs transition active:scale-95 cursor-pointer"
            title="Delete all mail accounts from fleet"
          >
            <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span>Bulk Delete</span>
          </button>

          <button
            id="btn-bulk-import"
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 shadow-2xs transition cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            <span>Bulk Paste</span>
          </button>

          <button
            id="btn-export-accounts"
            onClick={handleExportText}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 shadow-2xs transition cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Export (.txt)</span>
          </button>

          <button
            id="btn-static-pa"
            onClick={() => {
              playSoftClick();
              setIsStaticPaModalOpen(true);
            }}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shadow-2xs transition active:scale-95 cursor-pointer"
            title="Open Static PA & STP.txt Manager"
          >
            <KeyRound className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            <span>Static PA</span>
          </button>

          <button
            id="btn-add-single-account"
            onClick={handleOpenAdd}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-[11px] font-semibold text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {/* ⚡ COMPACT INSTANT AUTO-PARSER & AUTO-CONNECT CARD */}
      <div
        className={`p-2.5 sm:p-3 rounded-xl border transition-all shadow-xs shrink-0 ${
          darkMode
            ? 'bg-slate-900/90 border-blue-900/40'
            : 'bg-blue-50/70 border-blue-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Zap className="w-3 h-3" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <span>Quick Add & Bulk Accounts Importer</span>
                <span className="text-[9px] px-1 py-0.2 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold">
                  Multi-Line
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Paste combo strings (<code className="font-mono text-blue-600 dark:text-blue-400">email|password|refresh_token|client_id</code>)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 transition"
            >
              📋 Full Modal
            </button>
            {quickString && (
              <button
                onClick={() => setQuickString('')}
                className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex flex-col gap-1.5">
          <textarea
            id="input-quick-account-string"
            rows={quickString.includes('\n') || quickString.length > 120 ? 3 : 1}
            placeholder="Paste combo strings here (one per line): user1@hotmail.com|pass|refresh_token|client_id"
            value={quickString}
            onChange={(e) => setQuickString(e.target.value)}
            className={`w-full p-2 font-mono text-[11px] rounded-lg border transition resize-y ${
              darkMode
                ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
            }`}
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {quickLines.length > 1 ? `Detected ${quickLines.length} accounts` : 'Single or multi-line'}
            </span>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                id="btn-quick-auto-connect"
                disabled={quickConnecting || !quickString.trim()}
                onClick={() => handleQuickAutoConnect(true)}
                className="flex items-center space-x-1 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs transition transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className={`w-3 h-3 ${quickConnecting ? 'animate-spin' : ''}`} />
                <span>
                  {quickConnecting
                    ? 'Connecting...'
                    : isMultiLineQuick
                    ? `Import & Connect (${quickLines.length})`
                    : 'Auto-Connect'}
                </span>
              </button>

              {!isMultiLineQuick && parsedQuickResult.isValid && (
                <button
                  id="btn-quick-add-only"
                  disabled={quickConnecting}
                  onClick={() => handleQuickAutoConnect(false)}
                  className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition"
                >
                  + Add to List
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Parsed Preview Chips */}
        {quickString.trim() && !isMultiLineQuick && (
          <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center space-x-1">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Live Parsed Values:</span>
              </span>
              {parsedQuickResult.isValid ? (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Ready to Connect
                </span>
              ) : (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Incomplete string: Need email and refresh token
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              {/* Email */}
              <div
                className={`p-2 rounded-lg border ${
                  parsedQuickResult.email
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">Email Address</div>
                <div className="font-semibold truncate text-[11px] mt-0.5">
                  {parsedQuickResult.email || '(None detected)'}
                </div>
              </div>

              {/* Password */}
              <div
                className={`p-2 rounded-lg border flex items-center justify-between ${
                  parsedQuickResult.password
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">Password</div>
                  <div className="font-mono text-[11px] mt-0.5">
                    {parsedQuickResult.password
                      ? showQuickPassword
                        ? parsedQuickResult.password
                        : '••••••••'
                      : '(None)'}
                  </div>
                </div>
                {parsedQuickResult.password && (
                  <button
                    type="button"
                    onClick={() => setShowQuickPassword(!showQuickPassword)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showQuickPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Refresh Token */}
              <div
                className={`p-2 rounded-lg border ${
                  parsedQuickResult.refreshToken
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                  Refresh Token ({parsedQuickResult.refreshToken.length} chars)
                </div>
                <div className="font-mono text-[11px] truncate mt-0.5">
                  {parsedQuickResult.refreshToken
                    ? `${parsedQuickResult.refreshToken.substring(0, 16)}...`
                    : '(Missing)'}
                </div>
              </div>

              {/* Client ID */}
              <div
                className={`p-2 rounded-lg border ${
                  parsedQuickResult.clientId
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">Client ID</div>
                <div className="font-mono text-[11px] truncate mt-0.5">
                  {parsedQuickResult.clientId || 'Default Microsoft App'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Multi-line Quick Banner */}
        {isMultiLineQuick && (
          <div className="mt-3 p-2.5 rounded-lg bg-blue-600/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
            <span className="font-medium">
              Multi-line detected: <b>{quickLines.length} account strings</b> ready to import.
            </span>
            <span className="text-[11px] opacity-80 font-mono">
              Click &quot;Auto-Import {quickLines.length} Accounts&quot; above to load all.
            </span>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
        <div
          className={`p-2 rounded-lg border ${
            darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
          } shadow-2xs`}
        >
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Total Inboxes
          </span>
          <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            {accounts.length}
          </p>
        </div>

        <div
          className={`p-2 rounded-lg border ${
            darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
          } shadow-2xs`}
        >
          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Healthy</span>
          </span>
          <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {totalConnected}
          </p>
        </div>

        <div
          className={`p-2 rounded-lg border ${
            darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
          } shadow-2xs`}
        >
          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center space-x-1">
            <AlertCircle className="w-3 h-3" />
            <span>Attention</span>
          </span>
          <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">
            {totalErrors}
          </p>
        </div>

        <div
          className={`p-2 rounded-lg border ${
            darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
          } shadow-2xs flex flex-col justify-between`}
        >
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Verification
          </span>
          <button
            id="btn-test-all-accounts"
            onClick={handleTestAllAccounts}
            disabled={isTestingAll || accounts.length === 0}
            className="flex items-center justify-center space-x-1 py-0.5 px-2 rounded bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-[10px] font-semibold border border-blue-200 dark:border-blue-800/60 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${isTestingAll ? 'animate-spin' : ''}`} />
            <span>
              {isTestingAll
                ? `Checking (${testProgress.current}/${testProgress.total})`
                : 'Test All'}
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            id="input-search-accounts"
            type="text"
            placeholder="Search email, label, client ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-8 pr-2.5 py-1 text-[11px] rounded-md border transition ${
              darkMode
                ? 'bg-slate-900/80 border-slate-700 text-slate-200 placeholder-slate-500 focus:border-blue-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500'
            }`}
          />
        </div>

        <div className="flex items-center space-x-1 self-start sm:self-auto text-[11px]">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            All ({accounts.length})
          </button>
          <button
            onClick={() => setFilterStatus('connected')}
            className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
              filterStatus === 'connected'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Valid ({totalConnected})
          </button>
          <button
            onClick={() => setFilterStatus('error')}
            className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
              filterStatus === 'error'
                ? 'bg-red-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Errors ({totalErrors})
          </button>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
        {filteredAccounts.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-xl border-slate-300 dark:border-slate-800">
            <Users className="w-8 h-8 text-slate-400 mb-1.5" />
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              No accounts match your criteria
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm">
              Use the Instant String Parser above or &quot;New Account&quot; to register Microsoft Graph inboxes.
            </p>
          </div>
        ) : (
          filteredAccounts.map((acc) => {
            const isFetching = acc.status === 'fetching';
            return (
              <div
                key={acc.id}
                id={`account-card-${acc.id}`}
                className={`p-2.5 sm:p-3 rounded-lg border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-2 ${
                  darkMode
                    ? 'bg-slate-900/60 hover:bg-slate-900/90 border-slate-800/80 shadow-2xs'
                    : 'bg-white hover:bg-slate-50/90 border-slate-200/90 shadow-2xs'
                }`}
              >
                {/* Account Main Info */}
                <div className="flex items-start space-x-2.5">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                    style={{ backgroundColor: acc.color || '#0078D4' }}
                  >
                    {acc.email.substring(0, 2).toUpperCase()}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <ClickableEmail
                        email={acc.email}
                        onCopied={(val) => triggerCopy(`top-email-${acc.id}`, val, `Email (${val})`)}
                        showIcon={false}
                      />
                      {acc.label && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                          {acc.label}
                        </span>
                      )}
                      {/* Status Tag */}
                      {acc.status === 'connected' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Valid</span>
                        </span>
                      )}
                      {(acc.status === 'error' || acc.status === 'expired_token') && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-medium flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          <span>Expired / Error</span>
                        </span>
                      )}
                      {acc.status === 'idle' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 font-medium">
                          Untested
                        </span>
                      )}
                    </div>

                    {/* Login Credentials Bar (Email & Password with 1-click Copy) */}
                    <div className="mt-1 flex items-center flex-wrap gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800/90 text-[11px]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 px-1 py-0.2 rounded bg-blue-500/10 flex items-center space-x-0.5">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Login</span>
                      </span>

                      {/* Copy Mail Button */}
                      <button
                        id={`btn-copy-mail-${acc.id}`}
                        onClick={() => triggerCopy(`mail-${acc.id}`, acc.email, `Email (${acc.email})`)}
                        className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border font-mono text-[10px] transition cursor-pointer ${
                          copiedKey === `mail-${acc.id}`
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                        }`}
                        title="Click to copy email address"
                      >
                        {copiedKey === `mail-${acc.id}` ? (
                          <Check className="w-2.5 h-2.5 text-white" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-slate-400" />
                        )}
                        <span className="font-semibold">Mail:</span>
                        <span className="truncate max-w-[120px] sm:max-w-[180px]">{acc.email}</span>
                      </button>

                      {/* Copy Pass Button */}
                      <button
                        id={`btn-copy-pass-${acc.id}`}
                        onClick={() => triggerCopy(`pass-${acc.id}`, acc.password || '', `Password for ${acc.email}`)}
                        className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border font-mono text-[10px] transition cursor-pointer ${
                          copiedKey === `pass-${acc.id}`
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                        }`}
                        title="Click to copy password"
                      >
                        {copiedKey === `pass-${acc.id}` ? (
                          <Check className="w-2.5 h-2.5 text-white" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-slate-400" />
                        )}
                        <span className="font-semibold">Pass:</span>
                        <span>{acc.password ? acc.password : '(no pass)'}</span>
                      </button>

                      {/* Copy Full Combo String Button */}
                      <button
                        id={`btn-copy-combo-${acc.id}`}
                        onClick={() =>
                          triggerCopy(
                            `combo-${acc.id}`,
                            `${acc.email}|${acc.password || ''}|${acc.refreshToken}|${acc.clientId}${
                              acc.userId ? `|${acc.userId}` : ''
                            }`,
                            `Full String for ${acc.email}`
                          )
                        }
                        className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition ml-auto cursor-pointer ${
                          copiedKey === `combo-${acc.id}`
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                        }`}
                        title="Copy full combo: mail|pass|refresh_token|client_id"
                      >
                        {copiedKey === `combo-${acc.id}` ? (
                          <Check className="w-2.5 h-2.5 text-white" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                        <span>Copy All</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="font-mono">
                        Client: {acc.clientId.substring(0, 8)}...
                      </span>
                      <span>•</span>
                      <span>
                        Messages: <b>{acc.messages?.length || 0}</b>
                      </span>
                      {acc.lastChecked && (
                        <>
                          <span>•</span>
                          <span>
                            Checked: {new Date(acc.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      )}
                    </div>

                    {acc.lastError && (
                      <p className="text-[10px] text-red-500 flex items-center space-x-1">
                        <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate max-w-md">{acc.lastError}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Account Action Buttons */}
                <div className="flex items-center space-x-1 self-end md:self-auto shrink-0">
                  <button
                    id={`btn-open-inbox-${acc.id}`}
                    onClick={() => onOpenInboxForAccount(acc.email)}
                    className="flex items-center space-x-1 px-2 py-1 rounded-md bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-[10px] font-semibold transition cursor-pointer"
                    title="View Inbox"
                  >
                    <Inbox className="w-3 h-3" />
                    <span>View Inbox</span>
                  </button>

                  <button
                    id={`btn-test-token-${acc.id}`}
                    disabled={isFetching}
                    onClick={() => handleTestAccount(acc)}
                    className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    title="Re-verify Microsoft OAuth Token"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin text-blue-500' : ''}`} />
                  </button>

                  <button
                    id={`btn-copy-${acc.id}`}
                    onClick={() => handleCopyLine(acc)}
                    className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    title="Copy mail|password|refresh_token|client_id"
                  >
                    <Copy className="w-3 h-3" />
                  </button>

                  <button
                    id={`btn-edit-${acc.id}`}
                    onClick={() => handleOpenEdit(acc)}
                    className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    title="Edit credentials"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  <button
                    id={`btn-delete-${acc.id}`}
                    onClick={() => handleDeleteAccount(acc.id, acc.email)}
                    className="p-1 rounded-md border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 transition cursor-pointer"
                    title="Delete Account"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-xl rounded-2xl p-5 shadow-2xl border ${
              darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold">Bulk Import Accounts</h3>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Paste accounts one per line in any standard format (pipe, colon, tab, or comma):
              <br />
              <code className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                email|password|refresh_token|client_id
              </code>
            </p>

            <textarea
              id="textarea-bulk-accounts"
              rows={8}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder={`user1@outlook.com|Pass123|0.AVw...refreshToken|d3590ed6-52b3-4102-aeff-aad2292ab01c\nuser2@hotmail.com|Pass456|0.AQ8...refreshToken|d3590ed6-52b3-4102-aeff-aad2292ab01c`}
              className={`w-full p-3 font-mono text-xs rounded-lg border transition ${
                darkMode
                  ? 'bg-slate-950 border-slate-800 text-slate-200'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-3">
              <div className="flex items-center space-x-2">
                <input
                  id="checkbox-autoverify-bulk"
                  type="checkbox"
                  checked={autoVerifyOnBulk}
                  onChange={(e) => setAutoVerifyOnBulk(e.target.checked)}
                  className="rounded border-slate-400 text-blue-600"
                />
                <label htmlFor="checkbox-autoverify-bulk" className="text-[11px] text-slate-600 dark:text-slate-300">
                  Automatically verify tokens & fetch inboxes after import
                </label>
              </div>

              <div className="flex space-x-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-confirm-bulk-import"
                  onClick={handleProcessBulkImport}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white shadow-md shadow-blue-500/25"
                >
                  Import {parseMultipleAccountStrings(bulkInput).length > 0 ? `(${parseMultipleAccountStrings(bulkInput).length})` : ''} Accounts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Account Add/Edit Modal */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveSingleAccount}
            className={`w-full max-w-lg rounded-2xl p-5 shadow-2xl border space-y-3.5 max-h-[90vh] overflow-y-auto ${
              darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold">
                  {editingAccountId ? 'Edit Mail Account' : 'Add Microsoft Mail Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSingleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Auto-Fill String Input */}
            <div
              className={`p-3 rounded-xl border ${
                modalAutoFilled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                  : darkMode
                  ? 'bg-blue-950/20 border-blue-900/40 text-blue-300'
                  : 'bg-blue-50/80 border-blue-200 text-blue-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5 text-blue-500" />
                  <span>⚡ Quick Paste & Auto-Fill All Form Fields:</span>
                </label>
                {modalAutoFilled && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                    <Check className="w-3 h-3" />
                    <span>Fields Auto-Populated!</span>
                  </span>
                )}
              </div>
              <input
                id="input-modal-quick-string"
                type="text"
                placeholder="Paste combo: email|password|refresh_token|client_id"
                value={modalQuickPaste}
                onChange={(e) => handleModalQuickPasteChange(e.target.value)}
                className={`w-full p-2 font-mono text-[11px] rounded-lg border ${
                  darkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Email Address *
                </label>
                <input
                  id="input-form-email"
                  type="email"
                  required
                  placeholder="name@outlook.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className={`w-full p-2 rounded-lg border ${
                    darkMode
                      ? 'bg-slate-950 border-slate-800 text-slate-100'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Password (Optional record)
                </label>
                <div className="relative">
                  <input
                    id="input-form-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Account password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className={`w-full p-2 pr-8 rounded-lg border ${
                      darkMode
                        ? 'bg-slate-950 border-slate-800 text-slate-100'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-xs space-y-1">
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                OAuth2 Refresh Token *
              </label>
              <textarea
                id="input-form-refreshtoken"
                required
                rows={3}
                placeholder="M.C514... or 0.AVwAl69G3k... raw refresh token"
                value={formRefreshToken}
                onChange={(e) => setFormRefreshToken(e.target.value)}
                className={`w-full p-2 font-mono text-[11px] rounded-lg border ${
                  darkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-100'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Client ID (Application ID) *
                </label>
                <input
                  id="input-form-clientid"
                  type="text"
                  required
                  placeholder="d3590ed6-52b3-4102-aeff-aad2292ab01c"
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  className={`w-full p-2 font-mono text-xs rounded-lg border ${
                    darkMode
                      ? 'bg-slate-950 border-slate-800 text-slate-100'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Telegram User/Chat ID (Optional)
                </label>
                <input
                  id="input-form-userid"
                  type="text"
                  placeholder="e.g. 682910482"
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value)}
                  className={`w-full p-2 rounded-lg border ${
                    darkMode
                      ? 'bg-slate-950 border-slate-800 text-slate-100'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Account Label / Tag
                </label>
                <input
                  id="input-form-label"
                  type="text"
                  placeholder="e.g. Work, Alerts, Server 1"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className={`w-full p-2 rounded-lg border ${
                    darkMode
                      ? 'bg-slate-950 border-slate-800 text-slate-100'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Color Tag
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 cursor-pointer"
                  />
                  <span className="font-mono text-xs text-slate-400">{formColor}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSingleModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-save-single-account"
                disabled={testingSingle}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white shadow-md shadow-blue-500/25"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{testingSingle ? 'Verifying...' : 'Save & Verify'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ⚠️ BULK DELETE ALL CONFIRMATION MODAL (IN-APP) */}
      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
              darkMode ? 'bg-slate-900 border-red-900/60 text-slate-100' : 'bg-white border-red-200 text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-600 dark:text-red-400">Bulk Delete All Mails</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Permanently delete fleet mailboxes</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-800 dark:text-red-200 space-y-2 mb-5">
              <p className="font-semibold">
                Are you sure you want to delete all <span className="underline font-bold">{accounts.length}</span> mail accounts?
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-red-700 dark:text-red-300">
                <li>Removes all valid, expired, bad, and error mail accounts.</li>
                <li>Clears all cached inbox messages and tokens.</li>
                <li>This action is immediate and cannot be undone.</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-bulk-delete"
                onClick={executeBulkDelete}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-lg shadow-red-600/30 transition transform active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete All ({accounts.length}) Mails</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ SINGLE ACCOUNT DELETE CONFIRMATION MODAL */}
      {singleDeleteAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div
            className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl border ${
              darkMode ? 'bg-slate-900 border-red-900/50 text-slate-100' : 'bg-white border-red-200 text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Remove Account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                  {singleDeleteAccount.email}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
              Are you sure you want to remove <span className="font-semibold font-mono">{singleDeleteAccount.email}</span> and its messages?
            </p>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setSingleDeleteAccount(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteSingle}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-md shadow-red-600/30 transition transform active:scale-95"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🔐 STATIC PA (STP.TXT) MODAL */}
      <StaticPaModal
        isOpen={isStaticPaModalOpen}
        onClose={() => setIsStaticPaModalOpen(false)}
        accounts={accounts}
        setAccounts={setAccounts}
        darkMode={darkMode}
        addToast={addToast}
        addLog={addLog}
      />
    </div>
  );
};
