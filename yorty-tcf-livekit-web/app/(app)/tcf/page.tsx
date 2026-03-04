import { APP_CONFIG_DEFAULTS } from '@/app-config';
import { App } from '@/components/app/app';

export default function TCFPage() {
  return <App appConfig={APP_CONFIG_DEFAULTS} />;
}
