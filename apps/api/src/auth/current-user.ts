import { UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './session-auth.guard.js';

/** The id set by `SessionAuthGuard`; throws if the guard did not run. */
export function currentUserId(req: AuthenticatedRequest): string {
  if (!req.user) throw new UnauthorizedException('Authentification requise');
  return req.user.id;
}
