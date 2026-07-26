import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { UserRole } from '../../modules/users/enums/user-role.enum';
import { AccessTokenPayload } from './jwt-auth.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role hierarchy — a role implicitly satisfies every role beneath it, so a
 * super_admin passes any @Roles('admin') check without every route having to
 * list both. Keep this exhaustive over UserRole.
 */
const EFFECTIVE_ROLES: Record<UserRole, readonly UserRole[]> = {
  [UserRole.USER]: [UserRole.USER],
  [UserRole.ADMIN]: [UserRole.ADMIN, UserRole.USER],
  [UserRole.SUPER_ADMIN]: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Routes without @Roles() remain available to any authenticated user.
    if (!requiredRoles?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenPayload }>();

    const user = request.user;
    const effectiveRoles = user ? EFFECTIVE_ROLES[user.role] : undefined;

    const isAllowed = effectiveRoles?.some((role) =>
      requiredRoles.includes(role),
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
