import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly enabled: boolean;
  private readonly executablePath?: string;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<boolean>('pdf.enabled') ?? true;
    const configuredPath = this.config.get<string>('pdf.chromiumExecutablePath');
    this.executablePath = configuredPath?.trim() || undefined;
  }

  async generate(html: string): Promise<Buffer> {
    if (!this.enabled) {
      throw new ServiceUnavailableException('PDF 导出功能未启用');
    }
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch({
        headless: true,
        ...(this.executablePath ? { executablePath: this.executablePath } : {}),
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.emulateMedia({ media: 'print' });
      const buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      return Buffer.from(buffer);
    } catch (error) {
      this.logger.error(`PDF generation failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        `PDF 生成失败：${(error as Error).message}。请确认服务器已安装 Chromium。`,
      );
    } finally {
      await browser?.close();
    }
  }
}
