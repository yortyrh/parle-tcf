import { describe, expect, it, vi } from "vitest";
import {
  assertTransportAllowed,
  resolveMailTransport,
  sendWithResend,
} from "./mail-transport.js";

const MAIL = {
  to: "alice@test.local",
  subject: "Confirmez votre adresse e-mail",
  html: "<p>Bonjour</p>",
  text: "Bonjour",
};
const FROM = "parle-tcf <no-reply@parle-tcf.test>";

function fakeFetch(status: number, body = "") {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    return new Response(body, { status });
  });
  return { fn, fetchImpl: fn as unknown as typeof fetch };
}

function captureError(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to throw");
}

describe("resolveMailTransport", () => {
  it("prefers Resend over SMTP and trims the key", () => {
    expect(
      resolveMailTransport({
        NODE_ENV: "development",
        RESEND_API_KEY: "  re_123  ",
        SMTP_URL: "smtp://127.0.0.1:1025",
      }),
    ).toEqual({ kind: "resend", apiKey: "re_123" });
  });

  it("uses Resend when only the key is set", () => {
    expect(
      resolveMailTransport({ NODE_ENV: "production", RESEND_API_KEY: "re_k" }),
    ).toEqual({ kind: "resend", apiKey: "re_k" });
  });

  it("falls back to SMTP when the Resend key is blank, and trims the url", () => {
    expect(
      resolveMailTransport({
        NODE_ENV: "development",
        RESEND_API_KEY: "   ",
        SMTP_URL: "  smtp://127.0.0.1:1025 ",
      }),
    ).toEqual({ kind: "smtp", url: "smtp://127.0.0.1:1025" });
  });

  it("uses SMTP when the Resend key is empty or absent", () => {
    expect(
      resolveMailTransport({
        NODE_ENV: "development",
        RESEND_API_KEY: "",
        SMTP_URL: "smtp://mail:25",
      }),
    ).toEqual({ kind: "smtp", url: "smtp://mail:25" });
    expect(
      resolveMailTransport({ NODE_ENV: "production", SMTP_URL: "smtp://m:2" }),
    ).toEqual({ kind: "smtp", url: "smtp://m:2" });
  });

  it("falls back to log when nothing usable is set", () => {
    expect(resolveMailTransport({ NODE_ENV: "development" })).toEqual({
      kind: "log",
    });
    expect(
      resolveMailTransport({
        NODE_ENV: "production",
        RESEND_API_KEY: " ",
        SMTP_URL: "\t ",
      }),
    ).toEqual({ kind: "log" });
    expect(
      resolveMailTransport({
        NODE_ENV: "test",
        RESEND_API_KEY: "",
        SMTP_URL: "",
      }),
    ).toEqual({ kind: "log" });
  });
});

describe("assertTransportAllowed", () => {
  it("rejects the log transport in production, naming both variables", () => {
    const error = captureError(() =>
      assertTransportAllowed({ kind: "log" }, "production"),
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("RESEND_API_KEY");
    expect(error.message).toContain("SMTP_URL");
  });

  it.each(["development", "test", ""])(
    "allows the log transport when NODE_ENV=%j",
    (nodeEnv) => {
      expect(assertTransportAllowed({ kind: "log" }, nodeEnv)).toBeUndefined();
    },
  );

  it("allows real transports in production", () => {
    expect(
      assertTransportAllowed({ kind: "resend", apiKey: "re_1" }, "production"),
    ).toBeUndefined();
    expect(
      assertTransportAllowed(
        { kind: "smtp", url: "smtp://mail:25" },
        "production",
      ),
    ).toBeUndefined();
  });
});

describe("sendWithResend", () => {
  it("posts the mail as JSON to the Resend API", async () => {
    const { fn, fetchImpl } = fakeFetch(200, '{"id":"msg_1"}');

    await expect(
      sendWithResend({
        apiKey: "re_secret",
        from: FROM,
        mail: MAIL,
        fetchImpl,
      }),
    ).resolves.toBeUndefined();

    expect(fn).toHaveBeenCalledTimes(1);
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      Authorization: "Bearer re_secret",
      "Content-Type": "application/json",
    });
    expect(init?.body).toBe(
      JSON.stringify({
        from: FROM,
        to: [MAIL.to],
        subject: MAIL.subject,
        html: MAIL.html,
        text: MAIL.text,
      }),
    );
  });

  it("resolves on any 2xx status", async () => {
    const { fetchImpl } = fakeFetch(202);
    await expect(
      sendWithResend({ apiKey: "k", from: FROM, mail: MAIL, fetchImpl }),
    ).resolves.toBeUndefined();
  });

  it.each([
    [422, "The from field is invalid"],
    [500, "upstream exploded"],
    [401, "missing api key"],
  ])(
    "throws with the status and body when Resend answers %i",
    async (status, body) => {
      const { fetchImpl } = fakeFetch(status, body);
      const promise = sendWithResend({
        apiKey: "k",
        from: FROM,
        mail: MAIL,
        fetchImpl,
      });
      await expect(promise).rejects.toBeInstanceOf(Error);
      await expect(promise).rejects.toThrow(String(status));
      await expect(promise).rejects.toThrow(body);
    },
  );

  it("propagates network errors from fetch", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    await expect(
      sendWithResend({ apiKey: "k", from: FROM, mail: MAIL, fetchImpl }),
    ).rejects.toThrow("ECONNRESET");
  });
});
