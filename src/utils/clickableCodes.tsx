import React, { useState } from 'react';
import { Copy, Check, Mail } from 'lucide-react';
import { copyToClipboard } from './clipboard';
import { playSoftClick } from './audio';

interface ClickableItemProps {
  text: string;
  onCopied?: (val: string) => void;
  variant?: 'number' | 'email';
}

export const ClickableNumber: React.FC<{ num: string; onCopied?: (num: string) => void }> = ({ num, onCopied }) => {
  return <ClickableItem text={num} onCopied={onCopied} variant="number" />;
};

export const ClickableEmail: React.FC<{ email: string; onCopied?: (email: string) => void; showIcon?: boolean }> = ({
  email,
  onCopied,
  showIcon = false
}) => {
  return <ClickableItem text={email} onCopied={onCopied} variant="email" showIcon={showIcon} />;
};

export const ClickableItem: React.FC<ClickableItemProps & { showIcon?: boolean }> = ({
  text,
  onCopied,
  variant = 'number',
  showIcon = false
}) => {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      playSoftClick();
      if (onCopied) onCopied(text);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isEmail = variant === 'email';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Click to copy "${text}"`}
      className={`inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded font-mono text-[11px] sm:text-xs transition transform active:scale-95 cursor-pointer select-all ${
        copied
          ? 'bg-emerald-600 text-white shadow-xs'
          : isEmail
          ? 'bg-sky-500/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 hover:border-sky-500'
          : 'font-bold bg-amber-400/20 dark:bg-amber-400/25 text-amber-900 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-400/35 hover:border-amber-500'
      }`}
    >
      {showIcon && isEmail && <Mail className="w-3 h-3 opacity-70 shrink-0" />}
      <span className="break-all">{text}</span>
      {copied ? (
        <Check className="w-3 h-3 text-white shrink-0" />
      ) : (
        <Copy className="w-3 h-3 opacity-60 hover:opacity-100 shrink-0" />
      )}
    </button>
  );
};

/**
 * Regex for standard email matching
 */
export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Regex for continuous numbers of 4+ digits
 */
export const NUMBER_4PLUS_REGEX = /\b\d{4,}\b/g;

/**
 * Extracts all unique numbers with 4 or more digits from text
 */
export function extractNumbers4Plus(text: string): string[] {
  if (!text) return [];
  const matches = text.match(NUMBER_4PLUS_REGEX);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

/**
 * Extracts all unique emails from text
 */
export function extractEmails(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

/**
 * Strips HTML tags cleanly for plaintext rendering
 */
export function cleanHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Renders text while converting:
 * 1. Emails -> Clickable copy pill (blue)
 * 2. 4+ digit numbers -> Clickable copy pill (amber)
 */
export const RenderClickableText: React.FC<{ text: string; onCopied?: (val: string) => void }> = ({
  text,
  onCopied
}) => {
  if (!text) return <span>No content</span>;

  // Split text by both emails and 4+ digit numbers
  const combinedRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\b\d{4,}\b)/g;
  const parts = text.split(combinedRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (EMAIL_REGEX.test(part)) {
          // Reset lastIndex because test() with global regex maintains state
          EMAIL_REGEX.lastIndex = 0;
          return <ClickableEmail key={`${part}-${index}`} email={part} onCopied={onCopied} />;
        }
        if (/^\d{4,}$/.test(part)) {
          return <ClickableNumber key={`${part}-${index}`} num={part} onCopied={onCopied} />;
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
};
