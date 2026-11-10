import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "../config/env.js";
import { MailService } from "./mail.service.js";

const MAIL_FROM = "parle-tcf <no-reply@mail.test>";
const TO = "alice@test.local";
const URL = "https://app.test/verify?token=abc&callbackURL=%2Ftcf";

const ENV_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "ENCRYPTION_KEYS",
  "ENCRYPTION_KEY_CURRENT",
  "MAIL_FROM",
  "RESEND_API_KEY",
  "SMTP_URL",
] as const;

type Deps = ConstructorParameters<typeof MailService>[0];

function fakeFetch(status = 200, body = '{"id":"msg_1"}') {
  return vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(body, { status }),
  );
}

function fakeSmtp() {
  const sendMail = vi.fn(async (_message: Record<string, unknown>) => ({
    messageId: "smtp-1",
  }));
  const smtpFactory = vi.fn((_url: string) => ({ sendMail }));
  return { sendMail, smtpFactory };
}

function build(
  fetchImpl = fakeFetch(),
  smtp = fakeSmtp(),
): {
  service: MailService;
  fetchImpl: ReturnType<typeof fakeFetch>;
  sendMail: ReturnType<typeof fakeSmtp>["sendMail"];
  smtpFactory: ReturnType<typeof fakeSmtp>["smtpFactory"];
} {
  const deps = {
    fetchImpl,
    smtpFactory: smtp.smtpFactory,
  } as unknown as Deps;
  return { service: new MailService(deps), fetchImpl, ...smtp };
}

describe("MailService", () => {
  let saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

  beforeEach(() => {
    saved = {};
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://u:p@127.0.0.1:5432/db";
    process.env.BETTER_AUTH_SECRET = "x".repeat(32);
    process.env.ENCRYPTION_KEYS = `v1:${Buffer.alloc(32, 1).toString("base64")}`;
    process.env.ENCRYPTION_KEY_CURRENT = "v1";
    process.env.MAIL_FROM = MAIL_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_URL;
    resetEnvCache();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetEnvCache();
    vi.restoreAllMocks();
  });

  describe("with RESEND_API_KEY", () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = "re_test_key";
      resetEnvCache();
    });

    it("renders the template and posts it to Resend from MAIL_FROM", async () => {
      const { service, fetchImpl, smtpFactory } = build();

      await service.send("verify-email", TO, { url: URL });

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, init] = fetchImpl.mock.calls[0];
      expect(url).toBe("https://api.resend.com/emails");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer re_test_key",
      });
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.from).toBe(MAIL_FROM);
      expect(body.to).toEqual([TO]);
      expect(body.subject).toBe("Confirmez votre adresse e-mail");
      expect(body.html).toEqual(
        expect.stringContaining(`href="${URL.replace("&", "&amp;")}"`),
      );
      expect(body.text).toEqual(expect.stringContaining(URL));
      expect(smtpFactory).not.toHaveBeenCalled();
    });

    it("wins over SMTP_URL", async () => {
      process.env.SMTP_URL = "smtp://127.0.0.1:1025";
      resetEnvCache();
      const { service, fetchImpl, smtpFactory, sendMail } = build();

      await service.send("reset-password", TO, { url: URL });

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(smtpFactory).not.toHaveBeenCalled();
      expect(sendMail).not.toHaveBeenCalled();
    });

    it("rejects when Resend answers with an error", async () => {
      const { service } = build(fakeFetch(500, "resend is down"));

      await expect(
        service.send("verify-email", TO, { url: URL }),
      ).rejects.toThrow(/500/);
    });
  });

  describe("with SMTP_URL", () => {
    beforeEach(() => {
      process.env.SMTP_URL = "smtp://127.0.0.1:1025";
      resetEnvCache();
    });

    it("sends through the SMTP factory built from the url", async () => {
      const { service, fetchImpl, smtpFactory, sendMail } = build();

      await service.send("delete-account", TO, { url: URL });

      expect(smtpFactory).toHaveBeenCalledWith("smtp://127.0.0.1:1025");
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledWith({
        from: MAIL_FROM,
        to: TO,
        subject: "Confirmez la suppression de votre compte",
        html: expect.stringContaining(`href="${URL.replace("&", "&amp;")}"`),
        text: expect.stringContaining(URL),
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("propagates SMTP failures", async () => {
      const smtp = fakeSmtp();
      smtp.sendMail.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const { service } = build(fakeFetch(), smtp);

      await expect(
        service.send("verify-email", TO, { url: URL }),
      ).rejects.toThrow("ECONNREFUSED");
    });

    it.each([
      [
        "sendVerificationEmail",
        "Confirmez votre adresse e-mail",
        (s: MailService) => s.sendVerificationEmail(TO, URL),
      ],
      [
        "sendPasswordResetEmail",
        "Réinitialisation de votre mot de passe",
        (s: MailService) => s.sendPasswordResetEmail(TO, URL),
      ],
      [
        "sendDeleteAccountEmail",
        "Confirmez la suppression de votre compte",
        (s: MailService) => s.sendDeleteAccountEmail(TO, URL),
      ],
    ])("%s sends the matching template", async (_name, subject, call) => {
      const { service, sendMail } = build();

      await call(service);

      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: MAIL_FROM,
          to: TO,
          subject,
          text: expect.stringContaining(URL),
        }),
      );
    });
  });

  describe("without a transport", () => {
    it("logs and resolves without fetch or SMTP", async () => {
      const { service, fetchImpl, smtpFactory, sendMail } = build();

      await expect(
        service.send("verify-email", TO, { url: URL }),
      ).resolves.toBeUndefined();

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(smtpFactory).not.toHaveBeenCalled();
      expect(sendMail).not.toHaveBeenCalled();
    });

    it("treats blank values as unset", async () => {
      process.env.RESEND_API_KEY = "   ";
      process.env.SMTP_URL = "  ";
      resetEnvCache();
      const { service, fetchImpl, smtpFactory } = build();

      await service.send("verify-email", TO, { url: URL });

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(smtpFactory).not.toHaveBeenCalled();
    });
  });

  describe("onModuleInit", () => {
    const init = async (service: MailService) => service.onModuleInit();

    it("refuses to start in production without a transport", async () => {
      process.env.NODE_ENV = "production";
      resetEnvCache();

      await expect(init(new MailService())).rejects.toThrow(/RESEND_API_KEY/);
      await expect(init(new MailService())).rejects.toThrow(/SMTP_URL/);
    });

    it("starts in production with Resend", async () => {
      process.env.NODE_ENV = "production";
      process.env.RESEND_API_KEY = "re_prod";
      resetEnvCache();

      await expect(init(new MailService())).resolves.toBeUndefined();
    });

    it("starts in production with SMTP", async () => {
      process.env.NODE_ENV = "production";
      process.env.SMTP_URL = "smtp://mail:25";
      resetEnvCache();

      await expect(init(new MailService())).resolves.toBeUndefined();
    });

    it("allows the log transport outside production", async () => {
      process.env.NODE_ENV = "development";
      resetEnvCache();

      await expect(init(new MailService())).resolves.toBeUndefined();
    });
  });
});
