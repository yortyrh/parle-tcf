import { App } from '@/components/app/app';
import { TEF_APP_CONFIG } from '@/tef-app-config';

export default function TEFPage() {
  return <App appConfig={TEF_APP_CONFIG} />;
}
