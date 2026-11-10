import { Global, Module, type Provider } from '@nestjs/common';
import { getEnv } from '../config/env.js';
import { AUDIO_STORAGE, type AudioStorage } from './audio-storage.js';
import { AudioService } from './audio.service.js';
import { S3AudioStorage } from './s3-audio-storage.js';

const storageProvider: Provider = {
  provide: AUDIO_STORAGE,
  useFactory: (): AudioStorage | null => {
    const env = getEnv();
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      return null;
    }
    return new S3AudioStorage({
      bucket: env.S3_BUCKET,
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  },
};

@Global()
@Module({
  providers: [storageProvider, AudioService],
  exports: [AudioService],
})
export class AudioModule {}
