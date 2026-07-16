import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

import { StandardResponse, isStandardResponse, successResponse } from '../utils/response.util';

/**
 * Uniform success envelope: { status, message, data }.
 * The frontend (RTK Query) can rely on one shape everywhere.
 *
 * If a module already returned a StandardResponse via `sendResponse`, it is
 * passed through untouched — otherwise the raw payload is wrapped here so
 * legacy handlers still emit the standard shape.
 */
@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((data) =>
        isStandardResponse(data)
          ? (data as StandardResponse<T>)
          : successResponse(data as T),
      ),
    );
  }
}
