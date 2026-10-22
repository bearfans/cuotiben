/**
 * 数学/物理符号库：按分类组织中学阶段常用符号。
 * - 纯符号：点击直接插入（以 $...$ 行内公式渲染）。
 * - 带变量符号：插入默认值后，可在编辑器中点击该符号再次修改变量。
 * 数据格式与 renderRichText 完全兼容（$...$ / $$...$$）。
 */

import katex from 'katex';

export interface SymbolVar {
  key: string;
  label: string;
  placeholder?: string;
  /** 变量为空时使用的 LaTeX（默认占位方块 □） */
  emptyLatex?: string;
}

export interface MathSymbol {
  id: string;
  name: string;
  /** 带变量的符号：变量列表 */
  vars?: SymbolVar[];
  /** 首次插入时各变量的默认值 */
  defaults?: Record<string, string>;
  /** 块级公式（$$...$$） */
  display?: boolean;
  /** 由变量值生成 LaTeX 表达式（不含外层 $） */
  latex: (v: Record<string, string>) => string;
  /** 从 LaTeX 反推变量值（用于点击已插入的符号再次编辑） */
  match?: (latex: string) => Record<string, string> | null;
}

export interface SymbolCategory {
  id: string;
  name: string;
  symbols: MathSymbol[];
}

const EMPTY = '\\square';

/** 占位方块还原为空值 */
function val(x: string): string {
  return x === EMPTY ? '' : x;
}

/** 读取从 i 开始的一对括号内容（支持嵌套），返回 [内容, 结束下标] */
function readGroupAt(s: string, i: number, open: '{' | '['): [string, number] | null {
  const close = open === '{' ? '}' : ']';
  if (s[i] !== open) return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === open) depth++;
    else if (s[j] === close) {
      depth--;
      if (depth === 0) return [s.slice(i + 1, j), j + 1];
    }
  }
  return null;
}

/** 若字符串整体被一对 {...} 包裹则取内部，否则原样返回 */
function braceBase(s: string): string {
  if (s.startsWith('{')) {
    const g = readGroupAt(s, 0, '{');
    if (g && g[1] === s.length) return g[0];
  }
  return s;
}

function starts(s: string, prefix: string, from = 0): number {
  return s.startsWith(prefix, from) ? from + prefix.length : -1;
}

const fixed = (latex: string): MathSymbol['latex'] => () => latex;

/* ============ 带变量的符号 ============ */

const fraction: MathSymbol = {
  id: 'fraction',
  name: '分数',
  vars: [
    { key: 'num', label: '分子', placeholder: '如 1' },
    { key: 'den', label: '分母', placeholder: '如 2' },
  ],
  defaults: { num: '1', den: '2' },
  latex: (v) => `\\frac{${v.num}}{${v.den}}`,
  match: (s) => {
    const i = starts(s, '\\frac');
    if (i < 0) return null;
    const g1 = readGroupAt(s, i, '{');
    if (!g1) return null;
    const g2 = readGroupAt(s, g1[1], '{');
    if (!g2 || g2[1] !== s.length) return null;
    return { num: val(g1[0]), den: val(g2[0]) };
  },
};

const ratio: MathSymbol = {
  id: 'ratio',
  name: '比例',
  vars: [
    { key: 'a', label: '左分子' },
    { key: 'b', label: '左分母' },
    { key: 'c', label: '右分子' },
    { key: 'd', label: '右分母' },
  ],
  defaults: { a: '1', b: '2', c: '3', d: '4' },
  latex: (v) => `\\frac{${v.a}}{${v.b}} = \\frac{${v.c}}{${v.d}}`,
  match: (s) => {
    const sep = ' = \\frac{';
    const p = s.indexOf(sep);
    if (p <= 0) return null;
    const left = s.slice(0, p);
    const right = s.slice(p + 3);
    const l1 = readGroupAt(left, 5, '{');
    const l2 = l1 ? readGroupAt(left, l1[1], '{') : null;
    if (!l1 || !l2 || l2[1] !== left.length) return null;
    const r1 = readGroupAt(right, 5, '{');
    const r2 = r1 ? readGroupAt(right, r1[1], '{') : null;
    if (!r1 || !r2 || r2[1] !== right.length) return null;
    return { a: val(l1[0]), b: val(l2[0]), c: val(r1[0]), d: val(r2[0]) };
  },
};

const powerSub: MathSymbol = {
  id: 'power-sub',
  name: '上下标',
  vars: [
    { key: 'base', label: '底数' },
    { key: 'sub', label: '下标' },
    { key: 'sup', label: '上标' },
  ],
  defaults: { base: 'a', sub: 'n', sup: '2' },
  latex: (v) => `{${v.base}}_{${v.sub}}^{${v.sup}}`,
  match: (s) => {
    const iSub = s.indexOf('_{');
    const iSup = s.indexOf('^{');
    if (iSub <= 0 || iSup <= iSub + 1 || !s.endsWith('}')) return null;
    const gSub = readGroupAt(s, iSub + 1, '{');
    const gSup = readGroupAt(s, iSup + 1, '{');
    if (!gSub || gSub[1] !== iSup || !gSup || gSup[1] !== s.length) return null;
    return { base: val(braceBase(s.slice(0, iSub))), sub: val(gSub[0]), sup: val(gSup[0]) };
  },
};

const power: MathSymbol = {
  id: 'power',
  name: '上标 / 幂',
  vars: [
    { key: 'base', label: '底数' },
    { key: 'exp', label: '指数' },
  ],
  defaults: { base: 'x', exp: '2' },
  latex: (v) => `{${v.base}}^{${v.exp}}`,
  match: (s) => {
    const i = s.indexOf('^{');
    if (i <= 0 || !s.endsWith('}')) return null;
    const g = readGroupAt(s, i + 1, '{');
    if (!g || g[1] !== s.length) return null;
    return { base: val(braceBase(s.slice(0, i))), exp: val(g[0]) };
  },
};

const subscript: MathSymbol = {
  id: 'subscript',
  name: '下标',
  vars: [
    { key: 'base', label: '底数' },
    { key: 'sub', label: '下标' },
  ],
  defaults: { base: 'a', sub: 'n' },
  latex: (v) => `{${v.base}}_{${v.sub}}`,
  match: (s) => {
    const i = s.indexOf('_{');
    if (i <= 0 || !s.endsWith('}')) return null;
    const g = readGroupAt(s, i + 1, '{');
    if (!g || g[1] !== s.length) return null;
    return { base: val(braceBase(s.slice(0, i))), sub: val(g[0]) };
  },
};

const sqrt: MathSymbol = {
  id: 'sqrt',
  name: '根号',
  vars: [
    { key: 'radicand', label: '被开方数', placeholder: '如 2' },
    { key: 'index', label: '根指数', placeholder: '留空为平方根', emptyLatex: '' },
  ],
  defaults: { radicand: '2', index: '' },
  latex: (v) => `\\sqrt${v.index ? `[${v.index}]` : ''}{${v.radicand}}`,
  match: (s) => {
    let i = starts(s, '\\sqrt');
    if (i < 0) return null;
    let index = '';
    if (s[i] === '[') {
      const g = readGroupAt(s, i, '[');
      if (!g) return null;
      index = g[0];
      i = g[1];
    }
    const g = readGroupAt(s, i, '{');
    if (!g || g[1] !== s.length) return null;
    return { radicand: val(g[0]), index };
  },
};

const abs: MathSymbol = {
  id: 'abs',
  name: '绝对值',
  vars: [{ key: 'x', label: '内容', placeholder: '如 x' }],
  defaults: { x: 'x' },
  latex: (v) => `\\left| ${v.x} \\right|`,
  match: (s) => {
    if (!s.startsWith('\\left| ') || !s.endsWith(' \\right|')) return null;
    return { x: val(s.slice(7, -8)) };
  },
};

const log: MathSymbol = {
  id: 'log',
  name: '对数',
  vars: [
    { key: 'base', label: '底数', placeholder: '留空为自然对数 ln', emptyLatex: '' },
    { key: 'x', label: '真数', placeholder: '如 8' },
  ],
  defaults: { base: '2', x: '8' },
  latex: (v) => (v.base ? `\\log_{${v.base}} ${v.x}` : `\\ln{${v.x}}`),
  match: (s) => {
    if (s.startsWith('\\ln{') && s.endsWith('}')) {
      return { base: '', x: val(s.slice(4, -1)) };
    }
    const i = starts(s, '\\log_{');
    if (i < 0) return null;
    const g = readGroupAt(s, i - 1, '{');
    if (!g) return null;
    const x = s.slice(g[1]).replace(/^\s+/, '');
    if (!x) return null;
    return { base: val(g[0]), x: val(x) };
  },
};

const sum: MathSymbol = {
  id: 'sum',
  name: '求和',
  display: true,
  vars: [
    { key: 'low', label: '下限', placeholder: '如 1' },
    { key: 'high', label: '上限', placeholder: '如 n' },
    { key: 'term', label: '通项', placeholder: '如 i' },
  ],
  defaults: { low: '1', high: 'n', term: 'i' },
  latex: (v) => `\\sum_{i=${v.low}}^{${v.high}} ${v.term}`,
  match: (s) => {
    if (!s.startsWith('\\sum_{i=')) return null;
    const a = s.indexOf('}^{', 8);
    if (a < 0) return null;
    const b = s.indexOf('} ', a + 3);
    if (b < 0) return null;
    return {
      low: val(s.slice(8, a)),
      high: val(s.slice(a + 3, b)),
      term: val(s.slice(b + 2)),
    };
  },
};

const sci: MathSymbol = {
  id: 'sci',
  name: '科学计数法',
  vars: [
    { key: 'a', label: '系数', placeholder: '如 3' },
    { key: 'n', label: '指数', placeholder: '如 8' },
  ],
  defaults: { a: '3', n: '8' },
  latex: (v) => `${v.a} \\times 10^{${v.n}}`,
  match: (s) => {
    if (!s.endsWith('}')) return null;
    const i = s.lastIndexOf('\\times 10^{');
    if (i <= 0) return null;
    const g = readGroupAt(s, i + 10, '{');
    if (!g || g[1] !== s.length) return null;
    return { a: val(s.slice(0, i).trim()), n: val(g[0]) };
  },
};

const arc: MathSymbol = {
  id: 'arc',
  name: '弧',
  vars: [{ key: 'arc', label: '端点字母', placeholder: '如 AB' }],
  defaults: { arc: 'AB' },
  latex: (v) => `\\overset{\\frown}{${v.arc}}`,
  match: (s) => {
    const i = starts(s, '\\overset{\\frown}{');
    if (i < 0 || !s.endsWith('}')) return null;
    return { arc: val(s.slice(i, -1)) };
  },
};

const segment: MathSymbol = {
  id: 'segment',
  name: '线段',
  vars: [{ key: 'ab', label: '端点字母', placeholder: '如 AB' }],
  defaults: { ab: 'AB' },
  latex: (v) => `\\overline{${v.ab}}`,
  match: (s) => {
    const i = starts(s, '\\overline');
    if (i < 0) return null;
    const g = readGroupAt(s, i, '{');
    if (!g || g[1] !== s.length) return null;
    return { ab: val(g[0]) };
  },
};

const vector: MathSymbol = {
  id: 'vector',
  name: '向量',
  vars: [{ key: 'ab', label: '端点字母', placeholder: '如 AB' }],
  defaults: { ab: 'AB' },
  latex: (v) => `\\overrightarrow{${v.ab}}`,
  match: (s) => {
    const i = starts(s, '\\overrightarrow');
    if (i < 0) return null;
    const g = readGroupAt(s, i, '{');
    if (!g || g[1] !== s.length) return null;
    return { ab: val(g[0]) };
  },
};

/** 带变量的符号；matchLatex 按此顺序尝试 */
const VAR_SYMBOLS = [
  powerSub,
  ratio,
  fraction,
  sqrt,
  log,
  abs,
  sci,
  sum,
  arc,
  segment,
  vector,
  power,
  subscript,
];

/* ============ 分类与全部符号 ============ */

function sym(
  id: string,
  name: string,
  latex: string,
  display = false,
): MathSymbol {
  return { id, name, latex: fixed(latex), display };
}

export const SYMBOL_CATEGORIES: SymbolCategory[] = [
  {
    id: 'basic',
    name: '基础符号',
    symbols: [
      sym('times', '乘号 ×', '\\times'),
      sym('div', '除号 ÷', '\\div'),
      sym('cdot', '点乘 ·', '\\cdot'),
      sym('pm', '正负号 ±', '\\pm'),
      sym('mp', '负正号 ∓', '\\mp'),
      sym('lt', '小于 <', '\\lt'),
      sym('gt', '大于 >', '\\gt'),
      sym('leq', '小于等于 ≤', '\\leq'),
      sym('geq', '大于等于 ≥', '\\geq'),
      sym('neq', '不等号 ≠', '\\neq'),
      sym('approx', '约等号 ≈', '\\approx'),
      sym('equiv', '恒等号 ≡', '\\equiv'),
      sym('propto', '成正比 ∝', '\\propto'),
      sym('because', '因为 ∵', '\\because'),
      sym('therefore', '所以 ∴', '\\therefore'),
      sym('infty', '无穷 ∞', '\\infty'),
      sym('percent', '百分号 %', '\\%'),
      sym('degree', '角度 °', '^{\\circ}'),
      sym('celsius', '摄氏度 ℃', '^{\\circ}\\mathrm{C}'),
    ],
  },
  {
    id: 'frac',
    name: '分式与乘方',
    symbols: [fraction, ratio, power, subscript, powerSub, sqrt, abs, log, sci, sum],
  },
  {
    id: 'units',
    name: '单位',
    symbols: [
      sym('mm', '毫米', '\\mathrm{mm}'),
      sym('cm', '厘米', '\\mathrm{cm}'),
      sym('dm', '分米', '\\mathrm{dm}'),
      sym('m', '米', '\\mathrm{m}'),
      sym('km', '千米', '\\mathrm{km}'),
      sym('cm2', '平方厘米', '\\mathrm{cm^2}'),
      sym('dm2', '平方分米', '\\mathrm{dm^2}'),
      sym('m2', '平方米', '\\mathrm{m^2}'),
      sym('km2', '平方千米', '\\mathrm{km^2}'),
      sym('hm2', '公顷', '\\mathrm{hm^2}'),
      sym('cm3', '立方厘米', '\\mathrm{cm^3}'),
      sym('dm3', '立方分米', '\\mathrm{dm^3}'),
      sym('m3', '立方米', '\\mathrm{m^3}'),
      sym('liter', '升', '\\mathrm{L}'),
      sym('milliliter', '毫升', '\\mathrm{mL}'),
      sym('mg', '毫克', '\\mathrm{mg}'),
      sym('g', '克', '\\mathrm{g}'),
      sym('kg', '千克', '\\mathrm{kg}'),
      sym('ton', '吨', '\\mathrm{t}'),
      sym('s', '秒', '\\mathrm{s}'),
      sym('min', '分钟', '\\mathrm{min}'),
      sym('h', '小时', '\\mathrm{h}'),
      sym('ms', '米/秒', '\\mathrm{m/s}'),
      sym('kmh', '千米/时', '\\mathrm{km/h}'),
      sym('kgm3', '千克/立方米', '\\mathrm{kg/m^3}'),
      sym('gcm3', '克/立方厘米', '\\mathrm{g/cm^3}'),
      sym('newton', '牛顿', '\\mathrm{N}'),
      sym('newtonkg', '牛/千克', '\\mathrm{N/kg}'),
      sym('Pa', '帕斯卡', '\\mathrm{Pa}'),
      sym('kPa', '千帕', '\\mathrm{kPa}'),
      sym('joule', '焦耳', '\\mathrm{J}'),
      sym('kwh', '千瓦时', '\\mathrm{kW \\cdot h}'),
      sym('watt', '瓦特', '\\mathrm{W}'),
      sym('kilowatt', '千瓦', '\\mathrm{kW}'),
      sym('ampere', '安培', '\\mathrm{A}'),
      sym('mA', '毫安', '\\mathrm{mA}'),
      sym('volt', '伏特', '\\mathrm{V}'),
      sym('mV', '毫伏', '\\mathrm{mV}'),
      sym('ohm', '欧姆', '\\Omega'),
      sym('kohm', '千欧', '\\mathrm{k\\Omega}'),
      sym('coulomb', '库仑', '\\mathrm{C}'),
      sym('Hz', '赫兹', '\\mathrm{Hz}'),
      sym('rad', '弧度', '\\mathrm{rad}'),
    ],
  },
  {
    id: 'geometry',
    name: '几何',
    symbols: [
      sym('angle', '角 ∠', '\\angle'),
      sym('triangle', '三角形 △', '\\triangle'),
      sym('square', '正方形 □', '\\square'),
      sym('circle', '圆 ⊙', '\\odot'),
      segment,
      vector,
      sym('parallel', '平行 ∥', '\\parallel'),
      sym('perp', '垂直 ⊥', '\\perp'),
      sym('similar', '相似 ∽', '\\backsim'),
      sym('congruent', '全等 ≌', '\\cong'),
      arc,
    ],
  },
  {
    id: 'set',
    name: '集合与逻辑',
    symbols: [
      sym('in', '属于 ∈', '\\in'),
      sym('notin', '不属于 ∉', '\\notin'),
      sym('subset', '真子集 ⊂', '\\subset'),
      sym('subseteq', '子集 ⊆', '\\subseteq'),
      sym('supset', '真包含 ⊃', '\\supset'),
      sym('supseteq', '包含 ⊇', '\\supseteq'),
      sym('union', '并集 ∪', '\\cup'),
      sym('intersect', '交集 ∩', '\\cap'),
      sym('emptyset', '空集 ∅', '\\varnothing'),
      sym('real', '实数集 ℝ', '\\mathbb{R}'),
      sym('natural', '自然数集 ℕ', '\\mathbb{N}'),
      sym('integer', '整数集 ℤ', '\\mathbb{Z}'),
      sym('rational', '有理数集 ℚ', '\\mathbb{Q}'),
      sym('complex', '复数集 ℂ', '\\mathbb{C}'),
      sym('forall', '任意 ∀', '\\forall'),
      sym('exists', '存在 ∃', '\\exists'),
      sym('land', '且 ∧', '\\land'),
      sym('lor', '或 ∨', '\\lor'),
      sym('neg', '非 ¬', '\\neg'),
      sym('implies', '推出 ⇒', '\\Rightarrow'),
      sym('iff', '等价 ⇔', '\\Leftrightarrow'),
    ],
  },
  {
    id: 'greek',
    name: '希腊字母',
    symbols: [
      sym('alpha', 'α', '\\alpha'),
      sym('beta', 'β', '\\beta'),
      sym('gamma', 'γ', '\\gamma'),
      sym('delta', 'δ', '\\delta'),
      sym('epsilon', 'ε', '\\varepsilon'),
      sym('eta', 'η', '\\eta'),
      sym('theta', 'θ', '\\theta'),
      sym('lambda', 'λ', '\\lambda'),
      sym('mu', 'μ', '\\mu'),
      sym('nu', 'ν', '\\nu'),
      sym('pi', 'π', '\\pi'),
      sym('rho', 'ρ', '\\rho'),
      sym('sigma', 'σ', '\\sigma'),
      sym('tau', 'τ', '\\tau'),
      sym('varphi', 'φ', '\\varphi'),
      sym('omega', 'ω', '\\omega'),
      sym('Delta', 'Δ', '\\Delta'),
      sym('Sigma', 'Σ', '\\Sigma'),
      sym('Phi', 'Φ', '\\Phi'),
      sym('Omega', 'Ω', '\\Omega'),
    ],
  },
];

export const ALL_SYMBOLS: MathSymbol[] = SYMBOL_CATEGORIES.flatMap((c) => c.symbols);

/** 由变量值生成 LaTeX；空值替换为占位方块（□），除非变量声明了 emptyLatex */
export function buildLatex(symbol: MathSymbol, raw: Record<string, string>): string {
  if (!symbol.vars?.length) return symbol.latex(raw);
  const v: Record<string, string> = {};
  for (const f of symbol.vars) {
    const input = (raw[f.key] ?? '').trim();
    v[f.key] = input || (f.emptyLatex ?? EMPTY);
  }
  return symbol.latex(v);
}

/** 首次插入时使用的变量默认值 */
export function defaultVars(symbol: MathSymbol): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of symbol.vars ?? []) v[f.key] = symbol.defaults?.[f.key] ?? '';
  return v;
}

/**
 * 从 LaTeX 反推对应的可编辑符号与变量值。
 * 命中后用 buildLatex 复核，保证按变量重建能与原文完全一致，避免误判。
 */
export function matchLatex(latex: string): { symbol: MathSymbol; vars: Record<string, string> } | null {
  const trimmed = latex.trim();
  for (const symbol of VAR_SYMBOLS) {
    if (!symbol.match) continue;
    try {
      const vars = symbol.match(trimmed);
      if (!vars) continue;
      if (buildLatex(symbol, vars) === trimmed) return { symbol, vars };
    } catch {
      // 忽略解析异常
    }
  }
  return null;
}

/** 符号示例的 KaTeX 渲染 HTML（用于面板预览） */
export function symbolPreviewHtml(symbol: MathSymbol): string {
  return renderKatexForPreview(buildLatex(symbol, defaultVars(symbol)), symbol.display === true);
}

export function renderKatexForPreview(expr: string, display: boolean): string {
  try {
    return katex.renderToString(expr, {
      throwOnError: false,
      displayMode: display,
      strict: false,
      trust: false,
    });
  } catch {
    return expr;
  }
}
