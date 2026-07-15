import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Attaches a stable request id to every request/response.
 * Honors an incoming x-request-id (from a proxy or the frontend) if present.
 * The logger and exception filter both surface this id, so any bug report
 * with an id can be traced to a single log line.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const id = (req.headers[REQUEST_ID_HEADER] as string) ?? randomUUID();
    req.headers[REQUEST_ID_HEADER] = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
