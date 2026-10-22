import sharp, { OverlayOptions } from 'sharp';

export interface StitchOptions {
  /** 每页统一到的目标宽度 */
  targetWidth: number;
  /** 拼接后允许的最大高度，超出按比例整体缩小 */
  maxHeight: number;
}

export interface StitchedImage {
  buffer: Buffer;
  width: number;
  height: number;
  pageCount: number;
}

/**
 * 把多张题目照片按顺序竖向拼接成一张长图，供 AI 一次识别。
 * 一道题目可能跨页拍摄，拼接后 AI 可以看到完整的连续上下文。
 */
export async function stitchImagesVertically(
  buffers: Buffer[],
  options: StitchOptions,
): Promise<StitchedImage> {
  if (!buffers.length) throw new Error('没有可拼接的图片');
  if (buffers.length === 1) {
    const meta = await sharp(buffers[0], { failOn: 'none' }).metadata();
    return {
      buffer: buffers[0],
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      pageCount: 1,
    };
  }

  // 1. 统一每页宽度，白底压平（避免透明通道变黑），顺便纠正 EXIF 方向
  const pages: { buffer: Buffer; width: number; height: number }[] = [];
  for (const buffer of buffers) {
    const normalized = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({ width: options.targetWidth, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    const meta = await sharp(normalized).metadata();
    pages.push({
      buffer: normalized,
      width: meta.width ?? options.targetWidth,
      height: meta.height ?? 0,
    });
  }

  // 2. 总高度超限时按比例整体缩小，控制发给 AI 的图片尺寸
  const totalHeight = pages.reduce((sum, page) => sum + page.height, 0);
  const scale = totalHeight > options.maxHeight ? options.maxHeight / totalHeight : 1;
  const canvasWidth = Math.max(1, Math.round(options.targetWidth * scale));

  const composites: OverlayOptions[] = [];
  let top = 0;
  for (const page of pages) {
    const height = Math.max(1, Math.round(page.height * scale));
    const width = Math.max(1, Math.round(page.width * scale));
    const input =
      scale === 1
        ? page.buffer
        : await sharp(page.buffer).resize(width, height, { fit: 'fill' }).toBuffer();
    composites.push({ input, left: Math.round((canvasWidth - width) / 2), top });
    top += height;
  }

  const buffer = await sharp({
    create: {
      width: canvasWidth,
      height: Math.max(1, top),
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites as any)
    .jpeg({ quality: 88 })
    .toBuffer();

  return { buffer, width: canvasWidth, height: Math.max(1, top), pageCount: pages.length };
}
