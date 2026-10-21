import dayjs from 'dayjs';
import katex from 'katex';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPlainSegment(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}

/** Render user/AI text with $...$ and $$...$$ LaTeX support. All non-math text is escaped. */
export function renderRichText(value?: string | null): string {
  if (!value) return '';
  const source = String(value);
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let result = '';
  let lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    result += formatPlainSegment(source.slice(lastIndex, index));
    const token = match[0];
    const displayMode = token.startsWith('$$');
    const expression = displayMode ? token.slice(2, -2) : token.slice(1, -1);
    try {
      result += katex.renderToString(expression, {
        throwOnError: false,
        displayMode,
        strict: false,
        trust: false,
      });
    } catch {
      result += escapeHtml(token);
    }
    lastIndex = index + token.length;
  }
  result += formatPlainSegment(source.slice(lastIndex));
  return result;
}

export function plainText(value?: string | null): string {
  return (value ?? '')
    .replace(/\$\$?/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDate(value?: string | null, template = 'YYYY-MM-DD'): string {
  if (!value) return '—';
  return dayjs(value).format(template);
}

export function formatRelative(value?: string | null): string {
  if (!value) return '—';
  const target = dayjs(value);
  const today = dayjs().startOf('day');
  const diff = target.startOf('day').diff(today, 'day');
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff < 0) return `逾期 ${Math.abs(diff)} 天`;
  if (diff <= 7) return `${diff} 天后`;
  return target.format('MM月DD日');
}

export function truncate(value: string, length = 60): string {
  const text = plainText(value);
  if (text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}

export function optionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}
