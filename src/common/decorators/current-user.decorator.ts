import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithUser {
  user?: Record<string, unknown>;
}

/** Extracts the authenticated user (populated by the JWT guard) from the request. */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
