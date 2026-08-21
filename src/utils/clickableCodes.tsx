import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from './clipboard';
import { playSoftClick } from './audio';

interface ClickableNumberProps {
  num: string;
  onCopied?: (num: string) => void;
}

export const ClickableNumber: React.FC<ClickableNumberProps> = ({ num, onCopied }) => {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(num);
    if (ok) {
      setCopied(true);
      playSoftClick();
      if (onCopied) onCopied(num);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Click to copy "${num}"`}
      className={`inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded font-mono font-bold text-[11px] sm:text-xs transition transform active:scale-95 cursor-pointer select-all ${
        copied
          ? 'bg-emerald-600 text-white shadow-xs'
          : 'bg-amber-400/20 dark:bg-amber-400/25 text-amber-900 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-400/35 hover:border-amber-500'
      }`}
    >
      <span>{num}</span>
      {copied ? (
        <Check className="w-3 h-3 text-white shrink-0" />
      ) : (
        <Copy className="w-3 h-3 opacity-60 hover:opacity-100 shrink-0" />
      )}
    </button>
  );
};

/**
 * Extracts all unique numbers with 4 or more digits from text
 */
export function extractNumbers4Plus(text: string): string[] {
  if (!text) return [];
  // Match 4 or more continuous digits
  const matches = text.match(/\b\d{4,}\b/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

/**
 * Strips HTML tags cleanly for plaintext rendering
 */
export function cleanHtmlToText(html: string): string {
  if (!html) return '';
  // Quick regex to strip HTML tags if present
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
 * Renders text while converting any number with 4+ digits into a clickable copy button
 */
export const RenderClickableText: React.FC<{ text: string; onCopied?: (num: string) => void }> = ({
  text,
  onCopied
}) => {
  if (!text) return <span>No content</span>;

  // Split text by 4+ digit numbers, keeping the matches
  const parts = text.split(/(\b\d{4,}\b)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (/^\d{4,}$/.test(part)) {
          return <ClickableNumber key={`${part}-${index}`} num={part} onCopied={onCopied} />;
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
};
