import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

let cachedCss: string | null = null;

export function getKatexCss(): string {
  if (cachedCss) return cachedCss;
  const katexDir = dirname(require.resolve('katex'));
  let css = readFileSync(join(katexDir, 'katex.min.css'), 'utf8');
  css = css.replace(/url\(fonts\/([^)]+)\)/g, (_match, filename: string) => {
    const extension = filename.split('.').pop() ?? 'woff2';
    const mime =
      extension === 'woff2'
        ? 'font/woff2'
        : extension === 'woff'
          ? 'font/woff'
          : 'font/ttf';
    const base64 = readFileSync(join(katexDir, 'fonts', filename)).toString('base64');
    return `url(data:${mime};base64,${base64})`;
  });
  cachedCss = css;
  return css;
}
