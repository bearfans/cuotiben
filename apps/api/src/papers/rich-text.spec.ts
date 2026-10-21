import { escapeHtml, renderRichText } from './rich-text';

describe('rich text rendering', () => {
  it('escapes raw HTML', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    const rendered = renderRichText('<img src=x onerror=alert(1)>');
    expect(rendered).not.toContain('<img');
    expect(rendered).toContain('&lt;img');
  });

  it('renders inline and display math', () => {
    const rendered = renderRichText('设 $x=1$，则\n$$x^2=1$$');
    expect(rendered).toContain('katex');
    expect(rendered).toContain('katex-display');
    expect(rendered).not.toContain('$x=1$');
  });

  it('renders simple markdown formatting and line breaks', () => {
    const rendered = renderRichText('**重点** 和 `代码`\n下一行');
    expect(rendered).toContain('<strong>重点</strong>');
    expect(rendered).toContain('<code>代码</code>');
    expect(rendered).toContain('<br/>');
  });

  it('does not throw on invalid math', () => {
    expect(() => renderRichText('$\\frac{1}{$')).not.toThrow();
  });

  it('handles empty values', () => {
    expect(renderRichText(null)).toBe('');
    expect(renderRichText(undefined)).toBe('');
  });
});
