import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import { z } from "zod";
import { getEnv } from "../config/env.js";
import {
  type Auth,
  BETTER_AUTH,
  enabledSocialProviders,
} from "./better-auth.js";
import { OAuthHandoffService } from "./oauth-handoff.service.js";
import { safeRedirectPath } from "./safe-redirect.js";

/** Session cookies Better Auth sets on the API origin during the OAuth callback. */
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_data",
];

const exchangeSchema = z.object({ code: z.string().min(1).max(200) });

/**
 * Social sign-in for a web app on another site (no third-party cookies):
 *   1. GET  /auth/oauth/:provider?redirect=/path  → provider (state cookie is first-party on the API)
 *   2. provider → /api/auth/callback/:provider (Better Auth) → GET /auth/oauth/complete
 *   3. /auth/oauth/complete trades the session cookie for a one-time code and
 *      redirects to `${WEB_URL}/connexion/retour?code=…&next=…`
 *   4. POST /auth/oauth/exchange {code} → {token}; the web app stores the bearer token.
 */
@Controller("auth/oauth")
export class OAuthController {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: Auth,
    private readonly handoff: OAuthHandoffService,
  ) {}

  /** Declared before `:provider` so "complete" is not taken for a provider id. */
  @Get("complete")
  async complete(
    @Req() req: Request,
    @Query("redirect") redirect: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { WEB_URL } = getEnv();
    const session = await this.auth.api
      .getSession({ headers: fromNodeHeaders(req.headers) })
      .catch(() => null);
    for (const name of SESSION_COOKIES) res.clearCookie(name, { path: "/" });

    if (!session?.session?.token) {
      res.redirect(302, `${WEB_URL}/connexion?erreur=oauth`);
      return;
    }
    const code = await this.handoff.issue(session.session.token);
    const target = new URL("/connexion/retour", `${WEB_URL}/`);
    target.searchParams.set("code", code);
    target.searchParams.set("next", safeRedirectPath(redirect));
    res.redirect(302, target.toString());
  }

  @Get(":provider")
  async start(
    @Param("provider") provider: string,
    @Query("redirect") redirect: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!enabledSocialProviders().includes(provider)) {
      throw new NotFoundException(
        `OAuth provider "${provider}" is not enabled`,
      );
    }
    const { BETTER_AUTH_URL, WEB_URL } = getEnv();
    const callbackURL = `${BETTER_AUTH_URL}/auth/oauth/complete?redirect=${encodeURIComponent(safeRedirectPath(redirect))}`;
    const { headers, response } = await this.auth.api.signInSocial({
      body: {
        provider,
        callbackURL,
        errorCallbackURL: `${WEB_URL}/connexion?erreur=oauth`,
        disableRedirect: true,
      },
      returnHeaders: true,
    });
    for (const cookie of headers.getSetCookie())
      res.append("Set-Cookie", cookie);
    if (!response?.url)
      throw new BadRequestException("Could not start OAuth sign-in");
    res.redirect(302, response.url);
  }

  @Post("exchange")
  @HttpCode(200)
  async exchange(@Body() body: unknown): Promise<{ token: string }> {
    const parsed = exchangeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Missing code");
    const token = await this.handoff.redeem(parsed.data.code);
    if (!token)
      throw new UnauthorizedException("Invalid or expired sign-in code");
    return { token };
  }
}
