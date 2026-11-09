import { Global, Module } from "@nestjs/common";
import { getEnv } from "../config/env.js";
import { SecretCipher } from "./secret-cipher.js";

@Global()
@Module({
  providers: [
    {
      provide: SecretCipher,
      useFactory: () => {
        const env = getEnv();
        return new SecretCipher(
          env.ENCRYPTION_KEYS,
          env.ENCRYPTION_KEY_CURRENT,
        );
      },
    },
  ],
  exports: [SecretCipher],
})
export class CryptoModule {}
