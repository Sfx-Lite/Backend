import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extracts the authenticated user (populated by the JWT guard) from the request. */
export const CurrentUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  return data ? user?.[data] : user;
});
