import { randomBytes } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { and, type Database, eq, gt, verification } from "@parle-tcf/db";
import { DATABASE } from "../database/database.tokens.js";

const PREFIX = "oauth-handoff:";
const TTL_MS = 2 * 60 * 1000;
export const HANDOFF_CLOCK = Symbol("HANDOFF_CLOCK");

/**
 * One-time codes that hand an OAuth session from the API origin to the web app.
 *
 * After the provider callback the session exists only as a cookie on the API
 * origin, which the web app (another site) cannot read. The API swaps it for a
 * code in the redirect URL and the web app exchanges the code for the bearer
 * token. Codes live in Better Auth's `verification` table, expire after two
 * minutes and can be redeemed once.
 */
@Injectable()
export class OAuthHandoffService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Optional()
    @Inject(HANDOFF_CLOCK)
    private readonly now: () => Date = () => new Date(),
  ) {}

  async issue(sessionToken: string): Promise<string> {
    const code = randomBytes(32).toString("base64url");
    await this.db.insert(verification).values({
      identifier: `${PREFIX}${code}`,
      value: sessionToken,
      expiresAt: new Date(this.now().getTime() + TTL_MS),
    });
    return code;
  }

  /** The session token, deleting the code; null when unknown, used or expired. */
  async redeem(code: string): Promise<string | null> {
    if (!code) return null;
    const [row] = await this.db
      .delete(verification)
      .where(
        and(
          eq(verification.identifier, `${PREFIX}${code}`),
          gt(verification.expiresAt, this.now()),
        ),
      )
      .returning({ value: verification.value });
    return row?.value ?? null;
  }
}
