import { MailAccount, TelegramSettings, SyncSettings, SyncLog, WinToast } from '../types';

const STORAGE_KEYS = {
  ACCOUNTS: 'winmail_accounts_v1',
  TELEGRAM: 'winmail_telegram_v1',
  SYNC: 'winmail_sync_v1',
  LOGS: 'winmail_logs_v1',
  THEME: 'winmail_theme_v1'
};

export const INITIAL_DEMO_ACCOUNTS: MailAccount[] = [
  {
    id: 'acc_demo_1',
    email: 'alex.morgan@outlook.com',
    password: '••••••••••',
    refreshToken: '0.AVwAl69G3kL9...demo_refresh_token_xyz',
    clientId: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
    userId: '682910482',
    status: 'connected',
    lastChecked: new Date(Date.now() - 3 * 60000).toISOString(),
    label: 'Primary Work',
    color: '#0078D4',
    messages: [
      {
        id: 'msg_101',
        subject: '🔒 Microsoft Security Alert: Single-Use Code 849204',
        from: {
          emailAddress: {
            name: 'Microsoft account team',
            address: 'account-security-noreply@accountprotection.microsoft.com'
          }
        },
        receivedDateTime: new Date(Date.now() - 12 * 60000).toISOString(),
        bodyPreview: 'We received your request for a single-use code to use with your Microsoft account. Your code is: 849204. If you didn\'t request this code, you can safely ignore this email.',
        body: {
          contentType: 'text',
          content: 'Hello Alex,\n\nWe received your request for a single-use code to use with your Microsoft account.\n\nYour single-use code is: 849204\n\nIf you didn\'t request this code, someone may be trying to access your account. Please check your recent activity.\n\nThanks,\nThe Microsoft account team'
        },
        isRead: false,
        importance: 'high',
        hasAttachments: false,
        accountEmail: 'alex.morgan@outlook.com',
        isStarred: true,
        aiAnalysis: {
          summary: 'Single-use security verification code from Microsoft for account authentication.',
          category: 'Verification Code / Security',
          urgency: 'critical',
          keyPoints: ['Security code is 849204', 'Valid for short period', 'Review account activity if unprompted'],
          actionRequired: true,
          actionItem: 'Enter code 849204 or review unauthorized login attempt',
          extractedCodes: ['849204']
        }
      },
      {
        id: 'msg_102',
        subject: 'Q3 Enterprise Architecture Review & Deployment Schedule',
        from: {
          emailAddress: {
            name: 'Elena Rostova',
            address: 'elena.rostova@techcorp.internal'
          }
        },
        receivedDateTime: new Date(Date.now() - 45 * 60000).toISOString(),
        bodyPreview: 'Hi Alex, please find the updated pipeline topology and Windows 11 rollout milestone chart attached. We are targeting Friday 18:00 UTC for staging cutoff.',
        body: {
          contentType: 'text',
          content: 'Hi Alex,\n\nFollowing up on yesterday\'s sync, here is the revised deployment schedule for the Windows 11 client fleet. Can you please confirm the Telegram webhook endpoint status before EOD?\n\nBest regards,\nElena Rostova'
        },
        isRead: true,
        importance: 'normal',
        hasAttachments: true,
        accountEmail: 'alex.morgan@outlook.com',
        isStarred: false,
        aiAnalysis: {
          summary: 'Status update on Q3 Enterprise deployment requesting Telegram webhook confirmation before EOD.',
          category: 'Personal / Work',
          urgency: 'high',
          keyPoints: ['Windows 11 fleet rollout schedule updated', 'Staging cutoff Friday 18:00 UTC', 'Needs Telegram webhook status confirmation'],
          actionRequired: true,
          actionItem: 'Confirm Telegram webhook endpoint status before EOD',
          suggestedReply: 'Hi Elena, thanks for the update. The Telegram webhook endpoint is verified and operating stably. We are on track for Friday.'
        }
      },
      {
        id: 'msg_103',
        subject: 'Invoice INV-2026-8819 Payment Received ($1,420.00)',
        from: {
          emailAddress: {
            name: 'Stripe Billing System',
            address: 'invoices@billing.stripe.com'
          }
        },
        receivedDateTime: new Date(Date.now() - 120 * 60000).toISOString(),
        bodyPreview: 'Thank you for your payment! Invoice #INV-2026-8819 for Azure Cloud compute cluster was settled successfully via Corporate Visa ending in 4092.',
        body: {
          contentType: 'text',
          content: 'Invoice Receipt: INV-2026-8819\nAmount: $1,420.00 USD\nStatus: Paid\nCard: Corporate Visa (...4092)\nDate: Today'
        },
        isRead: true,
        importance: 'normal',
        hasAttachments: false,
        accountEmail: 'alex.morgan@outlook.com',
        isStarred: false
      }
    ]
  },
  {
    id: 'acc_demo_2',
    email: 'server.alerts@hotmail.com',
    password: '••••••••••',
    refreshToken: '0.AQ8Ak789...demo_refresh_token_alert',
    clientId: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
    userId: '682910482',
    status: 'connected',
    lastChecked: new Date(Date.now() - 5 * 60000).toISOString(),
    label: 'Infra Alerts',
    color: '#D83B01',
    messages: [
      {
        id: 'msg_201',
        subject: '⚠️ AWS CloudWatch: CPU Utilization > 85% on Cluster-East',
        from: {
          emailAddress: {
            name: 'AWS CloudWatch Alerts',
            address: 'no-reply@sns.amazonaws.com'
          }
        },
        receivedDateTime: new Date(Date.now() - 8 * 60000).toISOString(),
        bodyPreview: 'Alarm Threshold Breached: CPUUtilization >= 85 for 3 consecutive data points. Region: us-east-1. Instance: i-0abc89f28912.',
        body: {
          contentType: 'text',
          content: 'ALARM: "High-CPU-East-Cluster" in US East (N. Virginia)\nDescription: Triggers auto-scaling container pool\nMetric: CPUUtilization > 85.0% for 3 periods of 60 seconds.'
        },
        isRead: false,
        importance: 'high',
        hasAttachments: false,
        accountEmail: 'server.alerts@hotmail.com',
        isStarred: true,
        aiAnalysis: {
          summary: 'Critical CloudWatch alarm: Cluster-East CPU exceeded 85% for 3 consecutive checks in us-east-1.',
          category: 'Urgent Action Required',
          urgency: 'critical',
          keyPoints: ['CPU utilization > 85%', 'Cluster instance i-0abc89f28912', 'Auto-scaling triggered'],
          actionRequired: true,
          actionItem: 'Check container load and scaling pool capacity'
        }
      }
    ]
  }
];

export const INITIAL_TELEGRAM_SETTINGS: TelegramSettings = {
  botToken: '',
  defaultChatId: '',
  autoForward: true,
  forwardUrgentOnly: false,
  sendOtpAlertsOnly: false,
  includeAiSummary: true,
  botStatus: 'not_configured'
};

export const INITIAL_SYNC_SETTINGS: SyncSettings = {
  autoSyncEnabled: true,
  intervalSeconds: 60,
  soundEnabled: true,
  toastEnabled: true,
  fetchLimit: 15,
  showOldByDefault: false
};

// Storage Getters and Setters
export function loadAccounts(): MailAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse accounts from localStorage', e);
  }
  return INITIAL_DEMO_ACCOUNTS;
}

export function saveAccounts(accounts: MailAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save accounts to localStorage', e);
  }
}

export function loadTelegramSettings(): TelegramSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TELEGRAM);
    if (raw) {
      return { ...INITIAL_TELEGRAM_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to parse telegram settings', e);
  }
  return INITIAL_TELEGRAM_SETTINGS;
}

export function saveTelegramSettings(settings: TelegramSettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.TELEGRAM, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save telegram settings', e);
  }
}

export function loadSyncSettings(): SyncSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNC);
    if (raw) {
      return { ...INITIAL_SYNC_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to parse sync settings', e);
  }
  return INITIAL_SYNC_SETTINGS;
}

export function saveSyncSettings(settings: SyncSettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SYNC, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save sync settings', e);
  }
}

export function loadLogs(): SyncLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return [
    {
      id: 'log_init',
      timestamp: new Date().toISOString(),
      type: 'info',
      message: 'Windows 11 Mail & Telegram Controller initialized successfully.'
    }
  ];
}

export function saveLogs(logs: SyncLog[]) {
  try {
    // Keep max 200 logs
    const trimmed = logs.slice(0, 200);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(trimmed));
  } catch (e) {}
}
