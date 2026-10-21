import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import sharp from 'sharp';
import {
  PAPER_SECTIONS,
  SUBJECT_MAP,
  questionTypeLabel,
  type PaperSettings,
  type QuestionOption,
} from '@myos/shared';
import { formatDate } from '../common/utils/date.util';
import { UploadsService } from '../uploads/uploads.service';
import { getKatexCss } from './katex-assets';
import { escapeHtml, renderRichText } from './rich-text';

type PaperWithItems = Prisma.PaperGetPayload<{
  include: { student: true; subject: true; items: true };
}>;

interface Snapshot {
  questionId: string;
  subjectId: string;
  subjectName: string;
  grade: number;
  semester: string;
  questionType: string;
  stem: string;
  options?: QuestionOption[] | null;
  correctAnswer?: string | null;
  studentAnswer?: string | null;
  analysis?: string | null;
  knowledgePoints: string[];
  difficulty: number;
  images: { id: string; kind: string }[];
}

const SECTION_ORDER = ['CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'OTHER'];

@Injectable()
export class PaperPrintService {
  constructor(private readonly uploads: UploadsService) {}

  async render(paper: PaperWithItems, options: { toolbar?: boolean } = {}): Promise<string> {
    const settings = (paper.settings ?? {}) as unknown as PaperSettings;
    const items = [...paper.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const imageCache = new Map<string, string>();
    const numbered = items.map((item, index) => ({
      item,
      number: index + 1,
      snapshot: item.snapshot as unknown as Snapshot,
    }));

    for (const entry of numbered) {
      for (const image of entry.snapshot.images ?? []) {
        if (image.kind !== 'FIGURE') continue;
        if (imageCache.has(image.id)) continue;
        const html = await this.loadImage(image.id, paper.userId);
        if (html) imageCache.set(image.id, html);
      }
    }

    const grouped = new Map<string, typeof numbered>();
    for (const entry of numbered) {
      const list = grouped.get(entry.item.section) ?? [];
      list.push(entry);
      grouped.set(entry.item.section, list);
    }

    const numerals = ['一', '二', '三', '四', '五'];
    const sections = SECTION_ORDER.filter((section) => grouped.has(section))
      .map((section, index) => {
        const list = grouped.get(section) ?? [];
        const name =
          PAPER_SECTIONS[section]?.split('、').slice(1).join('、') ?? '题目';
        return `
          <section class="section">
            <h2 class="section-title">${numerals[index] ?? index + 1}、${name}</h2>
            ${list.map((entry) => this.renderQuestion(entry, imageCache)).join('')}
          </section>`;
      })
      .join('');

    const answerItems = settings.includeAnswers
      ? await Promise.all(
          numbered.map(async (entry) => {
            const snapshot = entry.snapshot;
            const images = await this.renderImages(snapshot.images, paper.userId, imageCache);
            return `
              <div class="answer-item">
                <div class="answer-head"><span class="num">${entry.number}.</span> ${escapeHtml(questionTypeLabel(snapshot.questionType))}</div>
                <div class="answer-line"><strong>答案：</strong>${renderRichText(snapshot.correctAnswer || '略')}</div>
                ${
                  settings.includeStudentAnswer && snapshot.studentAnswer
                    ? `<div class="answer-line student-answer"><strong>原作答：</strong>${renderRichText(snapshot.studentAnswer)}</div>`
                    : ''
                }
                ${snapshot.analysis ? `<div class="analysis"><strong>解析：</strong>${renderRichText(snapshot.analysis)}</div>` : ''}
                ${
                  settings.includeKnowledgePoints && snapshot.knowledgePoints?.length
                    ? `<div class="kp-line">知识点：${snapshot.knowledgePoints.map(escapeHtml).join(' · ')}</div>`
                    : ''
                }
                ${images}
              </div>`;
          }),
        )
      : [];

    const subjectName =
      paper.subject?.name ?? SUBJECT_MAP[paper.subjectId ?? '']?.name ?? '错题';
    const title = paper.title || `${paper.student.name} · ${subjectName}错题重练卷`;

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${getKatexCss()}${this.baseCss()}</style>
</head>
<body>
  ${options.toolbar ? `<div class="toolbar"><button onclick="window.print()">打印 / 另存为 PDF</button><span>建议使用 A4 纸张，页边距默认</span></div>` : ''}
  <main class="paper">
    <h1 class="paper-title">${escapeHtml(title)}</h1>
    <div class="paper-meta">
      <span>姓名：${escapeHtml(paper.student.name)}</span>
      <span>日期：${formatDate(new Date(), 'YYYY年MM月DD日')}</span>
      ${settings.showScore !== false ? '<span>得分：__________</span>' : ''}
    </div>
    <div class="paper-hint">共 ${items.length} 题 · 请认真审题，独立完成</div>
    ${sections}
    ${
      settings.includeAnswers
        ? `<section class="answers">
            <h1 class="paper-title answer-title">参考答案与解析</h1>
            ${answerItems.join('')}
          </section>`
        : ''
    }
  </main>
</body>
</html>`;
  }

  private renderQuestion(
    entry: { number: number; snapshot: Snapshot },
    imageCache: Map<string, string>,
  ): string {
    const snapshot = entry.snapshot;
    const options = snapshot.options ?? [];
    const optionsHtml = options.length
      ? `<div class="options">${options
          .map(
            (option) =>
              `<div class="option"><span class="option-label">${escapeHtml(option.label)}.</span><span>${renderRichText(option.content)}</span></div>`,
          )
          .join('')}</div>`
      : '';

    let answerArea = '';
    if (snapshot.questionType === 'TRUE_FALSE') {
      answerArea = '<div class="tf-line">（　　）</div>';
    } else if (snapshot.questionType === 'FILL_BLANK') {
      answerArea = '<div class="fill-line"></div>';
    } else if (snapshot.questionType === 'SHORT_ANSWER') {
      answerArea = '<div class="answer-space"></div>';
    } else if (snapshot.questionType === 'OTHER') {
      answerArea = '<div class="answer-space small"></div>';
    }

    const images = (snapshot.images ?? [])
      .filter((image) => image.kind === 'FIGURE')
      .map((image) => imageCache.get(image.id) ?? '')
      .join('');

    return `<article class="question">
      <div class="stem"><span class="num">${entry.number}.</span>${renderRichText(snapshot.stem)}</div>
      ${optionsHtml}
      ${answerArea}
      ${images}
    </article>`;
  }

  private async renderImages(
    images: { id: string; kind: string }[] | undefined,
    userId: string,
    cache: Map<string, string>,
  ): Promise<string> {
    if (!images?.length) return '';
    const rendered: string[] = [];
    for (const image of images) {
      if (image.kind !== 'FIGURE') continue;
      if (cache.has(image.id)) {
        rendered.push(cache.get(image.id) ?? '');
        continue;
      }
      const html = await this.loadImage(image.id, userId);
      if (html) {
        cache.set(image.id, html);
        rendered.push(html);
      }
    }
    return rendered.join('');
  }

  private async loadImage(imageId: string, userId: string): Promise<string> {
    try {
      const { file, buffer } = await this.uploads.getBufferForUser(imageId, userId);
      const resized = await sharp(buffer)
        .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      return `<img class="figure" src="data:${file.mimeType};base64,${resized.toString('base64')}" alt="题目配图" />`;
    } catch {
      return '';
    }
  }

  private baseCss(): string {
    return `
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: #111827;
        font-size: 11.5pt;
        line-height: 1.7;
        background: #eef1f6;
      }
      .toolbar {
        position: sticky; top: 0; z-index: 10;
        display: flex; align-items: center; gap: 12px;
        padding: 10px 16px; background: #111827; color: #fff;
        font-size: 13px;
      }
      .toolbar button {
        border: 0; border-radius: 8px; padding: 8px 16px;
        background: #fff; color: #111827; font-weight: 600; cursor: pointer;
      }
      .paper {
        width: 210mm; min-height: 297mm; margin: 20px auto;
        padding: 18mm 16mm; background: #fff;
        box-shadow: 0 12px 40px rgba(15, 23, 42, .12);
      }
      .paper-title {
        margin: 0 0 6mm; text-align: center; font-size: 20pt;
        letter-spacing: 2px; font-weight: 700;
      }
      .paper-meta {
        display: flex; justify-content: space-between; gap: 8mm;
        padding-bottom: 3mm; margin-bottom: 2mm;
        border-bottom: 1px solid #374151; font-size: 10.5pt;
      }
      .paper-hint { color: #6b7280; font-size: 9.5pt; margin-bottom: 7mm; }
      .section { margin-bottom: 4mm; }
      .section-title { font-size: 12.5pt; margin: 5mm 0 3mm; font-weight: 700; break-after: avoid; page-break-after: avoid; }
      .question { margin-bottom: 4.5mm; break-inside: avoid; page-break-inside: avoid; }
      .stem { text-align: justify; }
      .num { font-weight: 700; margin-right: 2mm; }
      .options {
        display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 8mm;
        margin: 2mm 0 0 7mm;
      }
      .option { display: flex; gap: 1.5mm; align-items: flex-start; }
      .option-label { font-weight: 600; }
      .answer-space {
        height: 24mm; margin-top: 2mm;
        background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 10mm, #d1d5db 10mm, #d1d5db 10.2mm);
      }
      .answer-space.small { height: 14mm; }
      .fill-line { height: 8mm; border-bottom: 1px solid #9ca3af; margin: 2mm 0; }
      .tf-line { margin-top: 2mm; letter-spacing: 2mm; }
      .figure { display: block; max-width: 78%; max-height: 75mm; margin: 3mm auto; }
      .answers { break-before: page; page-break-before: always; }
      .answer-title { margin-top: 0; }
      .answer-item { margin-bottom: 4mm; break-inside: avoid; }
      .answer-head { font-weight: 700; margin-bottom: 1mm; }
      .answer-line { margin: 1mm 0; }
      .analysis { color: #374151; }
      .kp-line { color: #6b7280; font-size: 9.5pt; margin-top: 1mm; }
      .student-answer { color: #b45309; }
      .katex-display { margin: 2mm 0; }
      @page { size: A4; margin: 16mm 14mm; }
      @media print {
        body { background: #fff; }
        .toolbar { display: none !important; }
        .paper { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
      }
      @media screen and (max-width: 820px) {
        .paper { width: auto; min-height: 0; margin: 0; padding: 18px 16px; }
        .options { grid-template-columns: 1fr; }
      }
    `;
  }
}
