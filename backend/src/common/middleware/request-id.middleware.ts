import { randomUUID } from "crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

export const REQUEST_ID_HEADER = "X-Request-Id";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingId = req.headers[REQUEST_ID_HEADER.toLowerCase()] as string | undefined;
    const requestId = existingId ?? randomUUID();

    req.headers[REQUEST_ID_HEADER.toLowerCase()] = requestId;
    (req as Request & { requestId: string }).requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
