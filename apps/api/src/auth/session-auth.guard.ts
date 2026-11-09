import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { type Auth, BETTER_AUTH } from "./better-auth.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

/** Validates the Better Auth session cookie and exposes `request.user`. */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const result = await this.auth.api
      .getSession({ headers: fromNodeHeaders(request.headers) })
      .catch(() => null);

    if (!result?.user) {
      throw new UnauthorizedException("Authentification requise");
    }
    request.user = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    };
    return true;
  }
}
