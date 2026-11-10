import {
  account,
  session,
  user,
  verification,
  type Database,
} from "@parle-tcf/db";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
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

type SocialProviders = Record<
  string,
  { clientId: string; clientSecret: string }
>;

/** GitHub/Google are enabled when both their client id and secret are set. */
export function socialProvidersFromEnv(env = getEnv()): SocialProviders {
  const providers: SocialProviders = {};
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  return providers;
}

export function enabledSocialProviders(env = getEnv()): string[] {
  return Object.keys(socialProvidersFromEnv(env));
}

export function createAuth(
  db: Database,
  mail: MailService,
  onBeforeUserDelete?: (userId: string) => Promise<void>,
) {
  const env = getEnv();

  const socialProviders = socialProvidersFromEnv(env);

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
      // The link opens the web app, which verifies the token through the API and
      // stores the bearer token returned by the automatic sign-in.
      sendVerificationEmail: async ({ user: target, token }) => {
        await mail.sendVerificationEmail(
          target.email,
          webLink(env.WEB_URL, "/verifier-email", token),
        );
      },
    },
    // Lets users erase their account and every row hanging from it (ON DELETE CASCADE).
    user: {
      deleteUser: {
        enabled: true,
        // Always confirmed by email, so accounts created with GitHub/Google (no
        // password) can be deleted too. The web page calls the callback with the
        // bearer token.
        sendDeleteAccountVerification: async ({ user: target, token }) => {
          await mail.sendDeleteAccountEmail(
            target.email,
            webLink(env.WEB_URL, "/compte/suppression", token),
          );
        },
        // Recordings live outside the database: remove them before the cascade.
        beforeDelete: async (target) => {
          await onBeforeUserDelete?.(target.id);
        },
      },
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
    },
    socialProviders,
    // Sessions travel as `Authorization: Bearer`; new tokens come back in the
    // `set-auth-token` response header (exposed through CORS in main.ts).
    plugins: [bearer()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
