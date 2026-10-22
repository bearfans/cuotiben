import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import sharp from 'sharp';
import {
  aiRecognitionSchema,
  normalizeAiPayload,
  type AiRecognitionPayload,
} from '@myos/shared';
import { SYSTEM_PROMPT, buildUserPrompt } from '../ai.prompt';
import type { AiProvider, AiRecognitionInput, AiRecognitionOutput } from '../ai.types';

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly jsonMode: boolean;
  private readonly maxImageEdge: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ai.apiKey');
    if (!apiKey) {
      throw new Error('未配置 AI_API_KEY，请设置环境变量或使用 AI_PROVIDER=mock');
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: this.config.get<string>('ai.baseUrl'),
      timeout: this.config.get<number>('ai.timeoutMs') ?? 120_000,
      maxRetries: 0,
    });
    this.model = this.config.get<string>('ai.model') ?? 'gpt-4o-mini';
    this.jsonMode = this.config.get<boolean>('ai.jsonMode') ?? true;
    this.maxImageEdge = this.config.get<number>('ai.maxImageEdge') ?? 1600;
  }

  async recognize(input: AiRecognitionInput): Promise<AiRecognitionOutput> {
    const image = await sharp(input.image, { failOn: 'none' })
      .rotate()
      // For stitched images, only limit width to preserve aspect ratio and height
      .resize({
        width: this.maxImageEdge,
        height: input.isStitched ? undefined : this.maxImageEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 86 })
      .toBuffer();

    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildUserPrompt({
              grade: input.grade,
              semester: input.semester,
              subjectHint: input.subjectHint,
            }),
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${image.toString('base64')}`,
              detail: 'high',
            },
          },
        ],
      },
    ];

    let completion = await this.call(messages, this.jsonMode);
    let content = this.extractContent(completion);
    let payload: AiRecognitionPayload;
    try {
      payload = this.parsePayload(content);
    } catch (error) {
      this.logger.warn(`AI JSON parse failed, retrying once: ${(error as Error).message}`);
      messages.push({ role: 'assistant', content });
      messages.push({
        role: 'user',
        content: '上一条输出不是合法 JSON，或字段不符合要求。请只输出严格合法的 JSON，不要代码块和解释。',
      });
      completion = await this.call(messages, this.jsonMode);
      content = this.extractContent(completion);
      payload = this.parsePayload(content);
    }

    return {
      payload,
      raw: completion,
      tokensIn: completion.usage?.prompt_tokens ?? 0,
      tokensOut: completion.usage?.completion_tokens ?? 0,
      model: completion.model ?? this.model,
    };
  }

  private async call(messages: any[], jsonMode: boolean): Promise<any> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: 0.1,
      max_tokens: 8000,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    try {
      return await this.client.chat.completions.create(body as never);
    } catch (error) {
      const message = (error as Error).message.toLowerCase();
      if (jsonMode && (message.includes('response_format') || message.includes('json mode'))) {
        delete body.response_format;
        return this.client.chat.completions.create(body as never);
      }
      throw new Error(`AI 识别失败：${(error as Error).message}`);
    }
  }

  private extractContent(completion: any): string {
    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content;
    if (Array.isArray(content)) {
      return content
        .map((part: any) => (typeof part === 'string' ? part : part?.text ?? ''))
        .join('');
    }
    throw new Error('AI 没有返回有效内容');
  }

  private parsePayload(content: string): AiRecognitionPayload {
    const cleaned = content
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI 返回内容中没有 JSON 对象');
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const result = aiRecognitionSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`AI 返回结构不符合要求：${result.error.issues[0]?.message ?? 'unknown'}`);
    }
    return normalizeAiPayload(result.data);
  }
}
