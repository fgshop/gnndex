import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Observable, tap } from "rxjs";

const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "refreshTokenJwt",
  "secret",
  "twoFactorSecret",
  "twoFactorCode",
  "authorization",
]);

function maskSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(maskSensitive);
  }

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key)) {
      masked[key] = "***";
    } else if (typeof value === "object" && value !== null) {
      masked[key] = maskSensitive(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, originalUrl, body } = request;
    const requestId = request.requestId ?? request.headers["x-request-id"] ?? "unknown";
    const startTime = Date.now();

    const logEntry: Record<string, unknown> = {
      requestId,
      method,
      url: originalUrl,
    };

    if (body && Object.keys(body as Record<string, unknown>).length > 0) {
      logEntry.body = maskSensitive(body);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            JSON.stringify({
              ...logEntry,
              statusCode: response.statusCode,
              duration: `${duration}ms`,
            }),
          );
        },
        error: (error: unknown) => {
          const duration = Date.now() - startTime;
          const statusCode =
            error instanceof Object && "getStatus" in error
              ? (error as { getStatus: () => number }).getStatus()
              : 500;
          this.logger.warn(
            JSON.stringify({
              ...logEntry,
              statusCode,
              duration: `${duration}ms`,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        },
      }),
    );
  }
}
