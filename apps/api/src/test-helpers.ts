import { randomBytes } from "node:crypto";
import { SecretCipher } from "./crypto/secret-cipher.js";
import type {
  MintClientSecretParams,
  VerifyKeyResult,
  VoiceProvider,
} from "./providers/voice-provider.js";

export function testCipher(): SecretCipher {
  return new SecretCipher(`v1:${randomBytes(32).toString("base64")}`, "v1");
}

export interface FakeVoiceProvider extends VoiceProvider {
  mintCalls: { apiKey: string; params: MintClientSecretParams }[];
  verifyResult: VerifyKeyResult;
  mintError: Error | null;
}

export function fakeVoiceProvider(): FakeVoiceProvider {
  const fake: FakeVoiceProvider = {
    id: "openai",
    mintCalls: [],
    verifyResult: { ok: true },
    mintError: null,
    async mintClientSecret(apiKey, params) {
      fake.mintCalls.push({ apiKey, params });
      if (fake.mintError) throw fake.mintError;
      return "ek_test_ephemeral";
    },
    async verifyKey() {
      return fake.verifyResult;
    },
  };
  return fake;
}
