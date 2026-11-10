import type { Request } from 'express';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { type Auth, BETTER_AUTH } from './better-auth.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

/**
 * Validates `Authorization: Bearer <session token>` (Better Auth `bearer()` plugin)
 * and exposes `request.user`. Cookies are ignored on purpose: the web app lives on
 * another site and authenticates with bearer tokens only, which also rules out CSRF.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization ?? '';
    if (!/^bearer\s+\S+/i.test(authorization)) {
      throw new UnauthorizedException('Authentification requise');
    }
    const result = await this.auth.api
      .getSession({ headers: new Headers({ authorization }) })
      .catch(() => null);

    if (!result?.user) {
      throw new UnauthorizedException('Authentification requise');
    }
    request.user = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    };
    return true;
  }
}
