import {
  account,
  session,
  user,
  verification,
  type Database,
} from "@parle-tcf/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getEnv, parseCorsOrigins } from "../config/env.js";
import type { MailService } from "../mail/mail.service.js";

export const AUTH_BASE_PATH = "/api/auth";

/** Injection token for the Better Auth instance. */
export const BETTER_AUTH = Symbol("BETTER_AUTH");

/** Email links point at web pages, which call the API with the token. */
export function webLink(webUrl: string, path: string, token: string): string {
  const url = new URL(path, `${webUrl}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

export function createAuth(db: Database, mail: MailService) {
  const env = getEnv();

  const socialProviders: Record<
    string,
    { clientId: string; clientSecret: string }
  > = {};
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  return betterAuth({
    appName: "parle-tcf",
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: parseCorsOrigins(env),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    advanced: { database: { generateId: "uuid" } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: env.AUTH_EMAIL_VERIFICATION_ENABLED,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user: target, token }) => {
        await mail.sendPasswordResetEmail(
          target.email,
          webLink(env.WEB_URL, "/reinitialiser", token),
        );
      },
    },
    emailVerification: {
      sendOnSignUp: env.AUTH_EMAIL_VERIFICATION_ENABLED,
      autoSignInAfterVerification: true,
      // Better Auth verifies the token on the API, then redirects to the web app.
      sendVerificationEmail: async ({ user: target, token }) => {
        const verifyUrl = new URL(
          `${AUTH_BASE_PATH}/verify-email`,
          `${env.BETTER_AUTH_URL}/`,
        );
        verifyUrl.searchParams.set("token", token);
        verifyUrl.searchParams.set("callbackURL", `${env.WEB_URL}/tcf`);
        await mail.sendVerificationEmail(target.email, verifyUrl.toString());
      },
    },
    // Lets users erase their account and every row hanging from it (ON DELETE CASCADE).
    user: { deleteUser: { enabled: true } },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
    },
    socialProviders,
  });
}

export type Auth = ReturnType<typeof createAuth>;
