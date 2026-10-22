<template>
  <div class="rich-editor">
    <div
      ref="editorEl"
      class="editor-area rich-text"
      :class="{ 'is-empty': isEmpty }"
      contenteditable="true"
      :data-placeholder="placeholder"
      @input="onInput"
      @keydown="onKeydown"
      @paste="onPaste"
      @click="onTap"
    />

    <!-- 符号选择面板 -->
    <van-popup
      v-model:show="showPanel"
      position="bottom"
      round
      :style="{ height: '60vh' }"
    >
      <div class="symbol-panel">
        <div class="panel-head">
          <h3>插入符号</h3>
          <button type="button" class="close" @click="showPanel = false">
            <van-icon name="cross" />
          </button>
        </div>
        <p class="panel-tip">点击符号立即插入；插入后点击题干中的符号，可随时修改其中的变量</p>
        <div class="cat-row">
          <button
            v-for="c in categories"
            :key="c.id"
            type="button"
            class="cat-chip"
            :class="{ active: c.id === activeCategoryId }"
            @click="activeCategoryId = c.id"
          >
            {{ c.name }}
          </button>
        </div>
        <div class="symbol-grid">
          <button
            v-for="symbol in activeSymbols"
            :key="symbol.id"
            type="button"
            class="symbol-item"
            @click="onPick(symbol)"
          >
            <span class="symbol-preview rich-text" v-html="previewHtml(symbol)" />
            <small>{{ symbol.name }}</small>
          </button>
        </div>
      </div>
    </van-popup>

    <!-- 变量修改对话框 -->
    <van-popup v-model:show="showEditor" position="bottom" round :style="{ maxHeight: '85vh' }">
      <div class="var-dialog">
        <div class="panel-head">
          <h3>{{ editingSymbol?.name }}</h3>
          <button type="button" class="close" @click="showEditor = false">
            <van-icon name="cross" />
          </button>
        </div>
        <div class="var-body">
          <div v-for="f in editingSymbol?.vars ?? []" :key="f.key" class="field-row">
            <van-field
              v-model="varForm[f.key]"
              :label="f.label"
              :placeholder="f.placeholder || '点击填写'"
            />
          </div>
          <div class="var-preview">
            <span class="preview-label">效果预览</span>
            <div class="preview-box rich-text" :class="{ 'is-block': editingSymbol?.display }" v-html="varPreviewHtml" />
          </div>
          <p class="var-hint">确定后可随时点击该符号再次修改</p>
        </div>
        <div class="var-foot">
          <van-button block round plain @click="showEditor = false">取消</van-button>
          <van-button block round type="primary" @click="confirmVars">确定</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import katex from 'katex';
import { escapeHtml } from '@/utils/format';
import {
  ALL_SYMBOLS,
  SYMBOL_CATEGORIES,
  buildLatex,
  defaultVars,
  matchLatex,
  symbolPreviewHtml,
  type MathSymbol,
} from '@/utils/formulas';

const props = defineProps<{
  modelValue?: string | null;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

/** 与 renderRichText 一致的公式识别规则，保证编辑与展示数据格式互通 */
const MATH_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math'; expr: string; display: boolean };

function parseSegments(source: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of source.matchAll(MATH_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', value: source.slice(lastIndex, index) });
    }
    const token = match[0];
    const display = token.startsWith('$$');
    segments.push({
      type: 'math',
      expr: display ? token.slice(2, -2) : token.slice(1, -1),
      display,
    });
    lastIndex = index + token.length;
  }
  if (lastIndex < source.length) {
    segments.push({ type: 'text', value: source.slice(lastIndex) });
  }
  return segments;
}

function renderKatex(expr: string, display: boolean): string {
  try {
    return katex.renderToString(expr, {
      throwOnError: false,
      displayMode: display,
      strict: false,
      trust: false,
    });
  } catch {
    return escapeHtml(expr);
  }
}

/** 由 LaTeX 片段生成符号 span 的 HTML；可识别的带变量符号会附带元数据 */
function mathSpanHtml(expr: string, display: boolean): string {
  const hit = matchLatex(expr);
  const attrs = [`class="math-fe"`, `contenteditable="false"`, `data-latex="${escapeHtml(expr)}"`];
  if (display) attrs.push(`data-display="1"`);
  if (hit) {
    attrs.push(`data-template="${escapeHtml(hit.symbol.id)}"`);
    attrs.push(`data-vars="${escapeHtml(JSON.stringify(hit.vars))}"`);
  }
  return `<span ${attrs.join(' ')}>${renderKatex(expr, display)}</span>`;
}

function segmentToHtml(segment: Segment): string {
  if (segment.type === 'math') return mathSpanHtml(segment.expr, segment.display);
  return escapeHtml(segment.value).replace(/\n/g, '<br>');
}

/** 文本（含 $..$ 公式）→ 编辑器 HTML */
function toEditorHtml(value: string): string {
  return parseSegments(value)
    .map(segmentToHtml)
    .join('');
}

const editorEl = ref<HTMLElement | null>(null);
const isEmpty = ref(true);
/** 最近一次由本组件发出的值，用于识别「外部修改」再重渲染 */
let lastEmitted = '';
/** 最近一次编辑器内的光标位置，供插入符号使用 */
let savedRange: Range | null = null;

function renderValue(value: string): void {
  const el = editorEl.value;
  if (!el) return;
  el.innerHTML = value ? toEditorHtml(value) : '';
  lastEmitted = value;
  isEmpty.value = value.trim().length === 0;
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof HTMLElement)) return node.textContent ?? '';
  const latex = node.dataset.latex;
  if (latex !== undefined) {
    return node.dataset.display ? `$$${latex}$$` : `$${latex}$`;
  }
  if (node.tagName === 'BR') return '\n';
  const inner = Array.from(node.childNodes).map(serializeNode).join('');
  if (node.tagName === 'DIV' || node.tagName === 'P') return `\n${inner}`;
  return inner;
}

function serializeEditor(): string {
  const el = editorEl.value;
  if (!el) return '';
  return Array.from(el.childNodes).map(serializeNode).join('');
}

function onInput(): void {
  const value = serializeEditor();
  lastEmitted = value;
  isEmpty.value = value.trim().length === 0;
  emit('update:modelValue', value);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    document.execCommand('insertLineBreak');
    onInput();
  }
}

function onPaste(event: ClipboardEvent): void {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (text) {
    document.execCommand('insertText', false, text);
    onInput();
  }
}

function saveSelection(): void {
  const sel = window.getSelection();
  const el = editorEl.value;
  if (sel && sel.rangeCount > 0 && el && el.contains(sel.anchorNode)) {
    savedRange = sel.getRangeAt(0).cloneRange();
  }
}

/* ================= 符号面板与变量编辑 ================= */

const categories = SYMBOL_CATEGORIES;
const activeCategoryId = ref(categories[0]?.id ?? '');
const activeSymbols = computed(
  () => categories.find((c) => c.id === activeCategoryId.value)?.symbols ?? [],
);
const showPanel = ref(false);
const showEditor = ref(false);
const editingSymbol = ref<MathSymbol | null>(null);
const editingEl = ref<HTMLElement | null>(null);
const varForm = reactive<Record<string, string>>({});

const varPreviewHtml = computed(() => {
  const symbol = editingSymbol.value;
  if (!symbol) return '';
  return renderKatex(buildLatex(symbol, varForm), symbol.display === true);
});

function previewHtml(symbol: MathSymbol): string {
  return symbolPreviewHtml(symbol);
}

function openSymbols(): void {
  showPanel.value = true;
}

/** 把符号渲染节点插入到光标处（无光标信息时追加到末尾） */
function insertNodeAtCaret(node: HTMLElement): HTMLElement | null {
  const el = editorEl.value;
  if (!el) return null;
  el.focus();
  const sel = window.getSelection();
  let range: Range;
  if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
    range = sel.getRangeAt(0);
  } else if (savedRange && el.contains(savedRange.startContainer)) {
    range = savedRange.cloneRange();
  } else {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.deleteContents();
  range.insertNode(node);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
  return node;
}

function buildSymbolSpan(symbol: MathSymbol, vars: Record<string, string>): HTMLElement {
  const span = document.createElement('span');
  span.className = 'math-fe';
  span.setAttribute('contenteditable', 'false');
  const latex = buildLatex(symbol, vars);
  span.dataset.latex = latex;
  if (symbol.display) span.dataset.display = '1';
  if (symbol.vars?.length) {
    span.dataset.template = symbol.id;
    span.dataset.vars = JSON.stringify(vars);
  }
  span.innerHTML = renderKatex(latex, symbol.display === true);
  return span;
}

function onPick(symbol: MathSymbol): void {
  const vars = symbol.vars?.length ? { ...defaultVars(symbol) } : {};
  const node = insertNodeAtCaret(buildSymbolSpan(symbol, vars));
  showPanel.value = false;
  onInput();
  // 带变量的符号：插入后立即弹出变量修改，引导填入自己的数值
  if (symbol.vars?.length) {
    openVarEditor(node, symbol);
  }
}

function onTap(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  const fe = target?.closest?.('.math-fe') as HTMLElement | null;
  if (!fe || !editorEl.value?.contains(fe)) return;
  // 优先使用 span 上的元数据；旧数据通过 LaTeX 反推识别
  const symbol =
    ALL_SYMBOLS.find((s) => s.id === fe.dataset.template) ??
    matchLatex(fe.dataset.latex ?? '')?.symbol;
  if (!symbol?.vars?.length) return;
  event.preventDefault();
  openVarEditor(fe, symbol);
}

function openVarEditor(el: HTMLElement | null, symbol: MathSymbol): void {
  editingEl.value = el;
  editingSymbol.value = symbol;
  Object.keys(varForm).forEach((key) => delete varForm[key]);
  let current: Record<string, string> = {};
  try {
    current = el?.dataset.vars ? JSON.parse(el.dataset.vars) : {};
  } catch {
    current = {};
  }
  if (el && !el.dataset.vars) {
    // 从旧数据反推而来的变量值
    current = matchLatex(el.dataset.latex ?? '')?.vars ?? current;
  }
  for (const f of symbol.vars ?? []) varForm[f.key] = current[f.key] ?? '';
  showEditor.value = true;
}

function confirmVars(): void {
  const symbol = editingSymbol.value;
  const el = editingEl.value;
  showEditor.value = false;
  if (!symbol || !el || !editorEl.value?.contains(el)) return;
  const vars: Record<string, string> = {};
  for (const f of symbol.vars ?? []) vars[f.key] = varForm[f.key] ?? '';
  const latex = buildLatex(symbol, vars);
  el.dataset.latex = latex;
  el.dataset.vars = JSON.stringify(vars);
  if (symbol.display) el.dataset.display = '1';
  else delete el.dataset.display;
  el.innerHTML = renderKatex(latex, symbol.display === true);
  onInput();
}

defineExpose({ openSymbols });

watch(
  () => props.modelValue,
  (value) => {
    if ((value ?? '') === lastEmitted) return;
    renderValue(value ?? '');
  },
);

onMounted(() => {
  document.addEventListener('selectionchange', saveSelection);
  renderValue(props.modelValue ?? '');
});

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', saveSelection);
});
</script>

<style scoped>
.editor-area {
  min-height: 66px;
  padding: 10px 16px;
  font-size: 14px;
  white-space: pre-wrap;
  outline: none;
  cursor: text;
}

.editor-area.is-empty::before {
  content: attr(data-placeholder);
  color: #c8c9cc;
  pointer-events: none;
}

/* 公式片段：整体作为一个不可拆分的元素参与编辑 */
.editor-area :deep(.math-fe) {
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  vertical-align: middle;
  scrollbar-width: none;
}

.editor-area :deep(.math-fe::-webkit-scrollbar) {
  display: none;
}

.symbol-panel,
.var-dialog {
  padding: 16px 16px calc(18px + var(--safe-bottom));
}

.symbol-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.symbol-panel .panel-head,
.symbol-panel .panel-tip,
.symbol-panel .cat-row {
  flex: 0 0 auto;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.panel-head h3 {
  margin: 0;
  font-size: 18px;
}

.close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-soft);
  color: var(--text-2);
}

.panel-tip {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 11.5px;
}

.cat-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 10px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.cat-chip {
  padding: 6px 13px;
  flex: 0 0 auto;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}

.cat-chip.active {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
}

.symbol-grid {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: repeat(3, 1fr);
  align-content: start;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.35) transparent;
}

.symbol-grid::-webkit-scrollbar {
  width: 5px;
}

.symbol-grid::-webkit-scrollbar-track {
  background: transparent;
}

.symbol-grid::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.35);
}

.cat-row::-webkit-scrollbar {
  display: none;
}

.symbol-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 12px 4px 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}

.symbol-item:active {
  background: var(--surface-soft);
}

.symbol-preview {
  min-height: 26px;
  max-width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0 2px;
  font-size: 15px;
  line-height: 1.3;
  scrollbar-width: none;
}

.symbol-preview::-webkit-scrollbar {
  display: none;
}

/* 面板内预览不需要全局 rich-text 的滚动条与外边距 */
.symbol-preview :deep(.katex-display) {
  margin: 2px 0;
  padding: 0;
  overflow: visible;
}

.symbol-item small {
  color: var(--muted);
  font-size: 10px;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.var-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 52vh;
  overflow-y: auto;
  scrollbar-width: none;
}

.var-body::-webkit-scrollbar,
.preview-box::-webkit-scrollbar {
  display: none;
}

.field-row :deep(.van-field) {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
}

.var-preview {
  margin-top: 4px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
}

.preview-label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
}

.preview-box {
  min-height: 30px;
  font-size: 16px;
  line-height: 1.5;
  overflow-x: auto;
  scrollbar-width: none;
}

.preview-box.is-block {
  min-height: 56px;
  text-align: center;
}

.preview-box :deep(.katex-display) {
  margin: 4px 0;
  overflow-x: auto;
}

.var-hint {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.var-foot {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
</style>
