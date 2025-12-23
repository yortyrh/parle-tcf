import { App } from '@/components/app/app';
import { getAppConfig } from '@/lib/utils';

export default function Page() {
  const appConfig = getAppConfig();

  return <App appConfig={appConfig} />;
}
