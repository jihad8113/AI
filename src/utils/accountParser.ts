import { MailAccount } from '../types';

export interface ParsedAccountResult {
  email: string;
  password?: string;
  refreshToken: string;
  clientId: string;
  clientSecret?: string;
  userId?: string;
  isValid: boolean;
  error?: string;
  raw: string;
}

/**
 * Robustly parses account credentials from single or multi-delimiter strings.
 * Supports standard combo formats:
 * - email|password|refresh_token|client_id
 * - email|password|refresh_token|client_id|userId
 * - email|refresh_token|client_id
 * - email:password:refresh_token:client_id
 * - JSON format objects
 */
export function parseAccountString(input: string): ParsedAccountResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      email: '',
      refreshToken: '',
      clientId: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
      isValid: false,
      error: 'Empty input string',
      raw: input
    };
  }

  // Handle JSON object input
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      const email = (obj.email || obj.mail || obj.user || '').toString().trim();
      const password = (obj.password || obj.pass || '').toString().trim();
      const refreshToken = (obj.refreshToken || obj.refresh_token || obj.token || '').toString().trim();
      const clientId = (obj.clientId || obj.client_id || obj.appId || 'd3590ed6-52b3-4102-aeff-aad2292ab01c').toString().trim();
      const clientSecret = (obj.clientSecret || obj.client_secret || '').toString().trim();
      const userId = (obj.userId || obj.user_id || obj.chatId || '').toString().trim();
      return {
        email,
        password,
        refreshToken,
        clientId: clientId || 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
        clientSecret,
        userId,
        isValid: Boolean(email && refreshToken),
        raw: input
      };
    } catch {
      // fallback to delimiter parse
    }
  }

  // Determine delimiter: '|' is primary, then '\t', ';', ':', ','
  let delimiter = '|';
  if (!trimmed.includes('|')) {
    if (trimmed.includes('\t')) delimiter = '\t';
    else if (trimmed.includes(';')) delimiter = ';';
    else if (trimmed.includes(':') && (trimmed.match(/:/g) || []).length >= 2) delimiter = ':';
    else if (trimmed.includes(',')) delimiter = ',';
  }

  const parts = trimmed.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));

  if (parts.length >= 4) {
    // Standard format: email | password | refresh_token | client_id (| userId)
    const email = parts[0];
    const password = parts[1];
    const refreshToken = parts[2];
    const clientId = parts[3] || 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
    const userId = parts[4] || '';

    return {
      email,
      password,
      refreshToken,
      clientId: clientId || 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
      userId,
      isValid: Boolean(email && refreshToken),
      raw: input
    };
  } else if (parts.length === 3) {
    // Format could be:
    // A: email | refresh_token | client_id
    // B: email | password | refresh_token
    const isPart1Token =
      parts[1].length > 30 ||
      parts[1].startsWith('M.C') ||
      parts[1].startsWith('0.A') ||
      parts[1].startsWith('eyJ');

    if (isPart1Token) {
      return {
        email: parts[0],
        password: '',
        refreshToken: parts[1],
        clientId: parts[2] || 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
        isValid: Boolean(parts[0] && parts[1]),
        raw: input
      };
    } else {
      return {
        email: parts[0],
        password: parts[1],
        refreshToken: parts[2],
        clientId: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
        isValid: Boolean(parts[0] && parts[2]),
        raw: input
      };
    }
  } else if (parts.length === 2) {
    // email | refresh_token
    return {
      email: parts[0],
      refreshToken: parts[1],
      clientId: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
      isValid: Boolean(parts[0] && parts[1]),
      raw: input
    };
  }

  return {
    email: parts[0] || '',
    refreshToken: '',
    clientId: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
    isValid: false,
    error: 'Could not parse account string. Expected format: email|password|refresh_token|client_id',
    raw: input
  };
}

/**
 * Parses multiple lines of account strings into parsed account objects
 */
export function parseMultipleAccountStrings(input: string): ParsedAccountResult[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  return lines.map(parseAccountString).filter((p) => p.isValid || p.email.length > 0);
}

/**
 * Converts a parsed result into a full MailAccount object
 */
export function convertParsedToMailAccount(parsed: ParsedAccountResult, defaultColor = '#0078D4'): MailAccount {
  return {
    id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: parsed.email.trim(),
    password: parsed.password || '',
    refreshToken: parsed.refreshToken.trim(),
    clientId: parsed.clientId.trim() || 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
    clientSecret: parsed.clientSecret || '',
    userId: parsed.userId || '',
    label: parsed.email.split('@')[0] || 'Outlook Account',
    color: defaultColor,
    status: 'idle',
    lastChecked: null,
    messages: []
  };
}
