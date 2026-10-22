import {
  buildLatex,
  defaultVars,
  matchLatex,
  SYMBOL_CATEGORIES,
  type MathSymbol,
} from '../src/utils/formulas.ts';

let fail = 0;

// 1) 每个符号都能渲染出合法 latex（不为空）
for (const cat of SYMBOL_CATEGORIES) {
  for (const s of cat.symbols) {
    const latex = buildLatex(s, defaultVars(s));
    if (!latex) {
      console.log('EMPTY LATEX:', cat.id, s.id);
      fail++;
    }
  }
}

// 2) 变量符号：默认值 → latex → match 还原 → 重建，应与原文一致
for (const s of SYMBOL_CATEGORIES.flatMap((c) => c.symbols)) {
  if (!s.vars?.length) continue;
  const vars = defaultVars(s);
  const latex = buildLatex(s, vars);
  const hit = matchLatex(latex);
  if (!hit) {
    console.log('NO MATCH:', s.id, '->', latex);
    fail++;
    continue;
  }
  if (hit.symbol.id !== s.id) {
    console.log('WRONG SYMBOL:', s.id, 'matched', hit.symbol.id);
    fail++;
  }
  const again = buildLatex(hit.symbol, hit.vars);
  if (again !== latex) {
    console.log('ROUNDTRIP MISMATCH:', s.id, latex, '!=', again);
    fail++;
  }
}

// 3) 空变量 → 占位方块，match 后还原为空字符串
const frac = SYMBOL_CATEGORIES.find((c) => c.id === 'frac')!.symbols.find((x) => x.id === 'fraction')!;
const emptyLatex = buildLatex(frac, { num: '', den: '' });
if (emptyLatex !== '\\frac{\\square}{\\square}') {
  console.log('EMPTY PLACEHOLDER FAIL:', emptyLatex);
  fail++;
}
const hitEmpty = matchLatex(emptyLatex);
if (!hitEmpty || hitEmpty.vars.num !== '' || hitEmpty.vars.den !== '') {
  console.log('EMPTY MATCH FAIL:', JSON.stringify(hitEmpty));
  fail++;
}

// 4) 任意 AI/手写 latex 的典型样例应可识别
const samples: Array<[string, string | null]> = [
  ['\\frac{3}{4}', 'fraction'],
  ['\\sqrt{5}', 'sqrt'],
  ['\\sqrt[3]{8}', 'sqrt'],
  ['{x}^{2}', 'power'],
  ['{a}_{1}', 'subscript'],
  ['\\left| -3 \\right|', 'abs'],
  ['\\log_{2} 8', 'log'],
  ['\\ln{e}', 'log'],
  ['3 \\times 10^{8}', 'sci'],
  ['x + 1', null],
  ['\\alpha', null],
  ['\\frac{1}{2} + \\frac{3}{4}', null],
];
for (const [latex, expect] of samples) {
  const hit = matchLatex(latex);
  const got = hit ? hit.symbol.id : null;
  if (got !== expect) {
    console.log(`SAMPLE FAIL: ${latex} expected ${expect} got ${got}`, hit?.vars);
    fail++;
  }
}

console.log(fail === 0 ? 'ALL PASS' : `FAILED: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
