import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ErrorCode } from "../enums/error-code.enum";

interface StandardErrorResponse {
  timestamp: string;
  requestId: string;
  code: string;
  message: string;
  details: Record<string, unknown>;
}

const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.AUTH_TOKEN_INVALID,
  [HttpStatus.FORBIDDEN]: ErrorCode.AUTH_FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.AUTH_EMAIL_IN_USE,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMIT_EXCEEDED,
};

function extractMessageAndDetails(
  exception: HttpException,
): { message: string; details: Record<string, unknown> } {
  const response = exception.getResponse();

  if (typeof response === "string") {
    return { message: response, details: {} };
  }

  if (typeof response === "object" && response !== null) {
    const body = response as Record<string, unknown>;
    const rawMessage = body["message"];
    let message: string;
    let details: Record<string, unknown> = {};

    if (Array.isArray(rawMessage)) {
      message = "Validation failed";
      details = { errors: rawMessage };
    } else if (typeof rawMessage === "string") {
      message = rawMessage;
    } else {
      message = exception.message;
    }

    if (body["details"] && typeof body["details"] === "object") {
      details = { ...details, ...(body["details"] as Record<string, unknown>) };
    }

    return { message, details };
  }

  return { message: exception.message, details: {} };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const requestId = request.requestId ?? request.headers["x-request-id"] as string ?? "unknown";

    let status: number;
    let code: string;
    let message: string;
    let details: Record<string, unknown>;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const extracted = extractMessageAndDetails(exception);
      message = extracted.message;
      details = extracted.details;

      const exceptionResponse = exception.getResponse();
      if (
        typeof exceptionResponse === "object" &&
        exceptionResponse !== null &&
        "code" in exceptionResponse &&
        typeof (exceptionResponse as Record<string, unknown>)["code"] === "string"
      ) {
        code = (exceptionResponse as Record<string, unknown>)["code"] as string;
      } else {
        code = HTTP_STATUS_TO_ERROR_CODE[status] ?? ErrorCode.INTERNAL_ERROR;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ErrorCode.INTERNAL_ERROR;
      message = "Internal server error";
      details = {};

      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: StandardErrorResponse = {
      timestamp: new Date().toISOString(),
      requestId,
      code,
      message,
      details,
    };

    response.status(status).json(body);
  }
}
