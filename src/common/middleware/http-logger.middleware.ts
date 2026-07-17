import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER } from './request-id.middleware';

/**
 * Structured request log: method, path, status, duration, ip, request id.
 * Never logs bodies — KYC payloads and credentials must not reach logs (§09).
 */
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    const { method, originalUrl } = req;
    const ip = req.ips?.length ? req.ips[0] : req.ip;

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
      const requestId = String(req.headers[REQUEST_ID_HEADER] ?? '');
      const line = `${method} ${originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms ip=${ip} reqId=${requestId}`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });

    next();
  }
}
