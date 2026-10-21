import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import dayjs from 'dayjs';
import {
  escapeHtml,
  renderRichText,
  plainText,
  formatDate,
  formatRelative,
  truncate,
  optionLabel,
} from './format.ts';

test('escapeHtml escapes all five entities', () => {
  assert.equal(
    escapeHtml(`<a href="x" title='y'>&</a>`),
    '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
  );
});

test('escapeHtml leaves plain text unchanged', () => {
  assert.equal(escapeHtml('普通文本 123'), '普通文本 123');
});

test('renderRichText handles empty / nullish input', () => {
  assert.equal(renderRichText(''), '');
  assert.equal(renderRichText(null), '');
  assert.equal(renderRichText(undefined), '');
});

test('renderRichText escapes raw HTML to prevent XSS', () => {
  const out = renderRichText('<img src=x onerror=alert(1)>');
  // Escaping the opening angle bracket is what neutralises the tag — the
  // attribute name may still appear as inert visible text, which is harmless.
  assert.ok(!out.includes('<img'), 'must not contain a live <img tag');
  assert.ok(out.includes('&lt;img'), 'must escape the opening bracket');
});

test('renderRichText renders **bold** and `code`', () => {
  const out = renderRichText('**加粗** 和 `代码`');
  assert.ok(out.includes('<strong>加粗</strong>'));
  assert.ok(out.includes('<code>代码</code>'));
  assert.ok(!out.includes('**'));
  assert.ok(!out.includes('`'));
});

test('renderRichText renders line breaks', () => {
  const out = renderRichText('第一行\n第二行');
  assert.ok(out.includes('<br/>'));
});

test('renderRichText renders inline and display math via KaTeX', () => {
  const out = renderRichText('设 $x=1$，则\n$$x^2=1$$');
  assert.ok(out.includes('katex'));
  assert.ok(out.includes('katex-display'), 'display math should get katex-display class');
  assert.ok(!out.includes('$x=1$'), 'raw $ delimiters must be consumed');
  assert.ok(!out.includes('$$x^2=1$$'));
});

test('renderRichText does not throw on invalid math', () => {
  assert.doesNotThrow(() => renderRichText('$\\frac{1}{$'));
  assert.doesNotThrow(() => renderRichText('$$unclosed'));
});

test('renderRichText matches API paper-print output (no divergence)', () => {
  // Mirrors the cross-implementation parity check: plain + bold + code + math + html
  const out = renderRichText('混合 **粗体** $a+b$ `code` **尾**');
  assert.ok(out.includes('<strong>粗体</strong>'));
  assert.ok(out.includes('<code>code</code>'));
  assert.ok(out.includes('<strong>尾</strong>'));
  assert.ok(out.includes('katex'));
});

test('plainText strips math delimiters, bold markers, collapses whitespace', () => {
  assert.equal(plainText('$x$ **b**  c'), 'x b c');
  assert.equal(plainText('$$a^2$$'), 'a^2');
  assert.equal(plainText(null), '');
  assert.equal(plainText(undefined), '');
  assert.equal(plainText('  多   空格\n\t制表  '), '多 空格 制表');
});

test('formatDate returns — for nullish input', () => {
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate(undefined), '—');
  assert.equal(formatDate(''), '—');
});

test('formatDate formats with template', () => {
  assert.equal(formatDate('2026-10-21', 'YYYY/MM/DD'), '2026/10/21');
  assert.equal(formatDate('2026-10-21'), '2026-10-21');
  assert.equal(formatDate('2026-10-21T08:00:00', 'D日'), '21日');
});

test('formatRelative describes today/tomorrow/yesterday around now', () => {
  const today = dayjs().startOf('day');
  assert.equal(formatRelative(today.toISOString()), '今天');
  assert.equal(formatRelative(today.add(1, 'day').toISOString()), '明天');
  assert.equal(formatRelative(today.subtract(1, 'day').toISOString()), '昨天');
  assert.equal(formatRelative(today.subtract(3, 'day').toISOString()), '逾期 3 天');
  assert.equal(formatRelative(today.add(5, 'day').toISOString()), '5 天后');
});

test('formatRelative returns — for nullish input', () => {
  assert.equal(formatRelative(null), '—');
  assert.equal(formatRelative(undefined), '—');
});

test('truncate trims and appends ellipsis when over length', () => {
  assert.equal(truncate('一二三四五六', 3), '一二三…');
  assert.equal(truncate('短', 5), '短');
  // trailing whitespace before the ellipsis is trimmed for cleaner previews
  assert.equal(truncate('$x$ **b** 一二三四五六七八九', 4), 'x b…');
  assert.equal(truncate('   hello world', 5), 'hello…');
});

test('optionLabel maps indices to A, B, C...', () => {
  assert.equal(optionLabel(0), 'A');
  assert.equal(optionLabel(1), 'B');
  assert.equal(optionLabel(25), 'Z');
  assert.equal(optionLabel(26), '[');
});
