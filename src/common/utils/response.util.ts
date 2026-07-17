/**
 * Standard API response envelope.
 *
 * Every module returns data through `sendResponse` so the frontend can rely on
 * ONE shape everywhere:
 *   { status: boolean, message: string, data: T }
 */
export interface StandardResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

/**
 * Build a successful response envelope.
 *
 * @example
 *   return successResponse(user, 'Registration successful');
 *   // → { status: true, message: 'Registration successful', data: user }
 */
export function successResponse<T>(
  data: T,
  message = 'Success',
): StandardResponse<T> {
  return {
    status: true,
    message,
    data,
  };
}

/**
 * Alias for `successResponse`. Preferred call site in services/controllers:
 *   return sendResponse(data, 'Created');
 */
export const sendResponse = successResponse;

/**
 * Type guard: is this value already a standard response envelope? Used by the
 * global response interceptor to avoid double-wrapping payloads that a module
 * has already passed through `sendResponse`.
 */
export function isStandardResponse(
  value: unknown,
): value is StandardResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).status === 'boolean' &&
    typeof (value as Record<string, unknown>).message === 'string' &&
    'data' in (value as Record<string, unknown>)
  );
}
