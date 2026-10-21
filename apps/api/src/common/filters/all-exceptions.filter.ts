import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器开小差了，请稍后重试';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const payload = body as { message?: string | string[]; error?: string; details?: unknown };
        if (Array.isArray(payload.message)) {
          message = payload.message[0] ?? message;
          details = payload.message;
        } else if (payload.message) {
          message = payload.message;
        } else if (payload.error) {
          message = payload.error;
        }
        details = payload.details ?? details;
      }
    } else if (exception instanceof Error && exception.name === 'MulterError') {
      status = HttpStatus.BAD_REQUEST;
      const code = (exception as Error & { code?: string }).code;
      message =
        code === 'LIMIT_FILE_SIZE'
          ? '单张图片不能超过 10MB'
          : code === 'LIMIT_FILE_COUNT' || code === 'LIMIT_UNEXPECTED_FILE'
            ? '一次最多上传 9 张图片'
            : '图片上传失败，请重试';
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = '数据已存在，请勿重复提交';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = '数据不存在或已被删除';
      } else {
        this.logger.error(`Prisma error ${exception.code}: ${exception.message}`);
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      code: status,
      message,
      ...(details ? { details } : {}),
    });
  }
}
