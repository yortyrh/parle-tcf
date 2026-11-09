import { randomBytes } from "node:crypto";
import { SecretCipher } from "./crypto/secret-cipher.js";
import {
  VoiceProviderRegistry,
  type ProviderId,
  type MintClientSecretParams,
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

export function registryOf(...providers: VoiceProvider[]) {
  return new VoiceProviderRegistry(providers);
}

export function fakeVoiceProvider(
  id: ProviderId = "openai",
): FakeVoiceProvider {
  const fake: FakeVoiceProvider = {
    id,
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
