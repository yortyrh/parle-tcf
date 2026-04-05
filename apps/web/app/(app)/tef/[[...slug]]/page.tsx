import { App } from '@/components/app/app';
import { TEF_APP_CONFIG } from '@/tef-app-config';

const VALID_TEF_TASK_TYPES = ['tef-section-a', 'tef-section-b'] as const;
type ValidTefTaskType = (typeof VALID_TEF_TASK_TYPES)[number];

function isValidTefTaskType(value: string): value is ValidTefTaskType {
  return VALID_TEF_TASK_TYPES.includes(value as ValidTefTaskType);
}

interface TEFPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function TEFPage({ params }: TEFPageProps) {
  const { slug } = await params;

  const rawTaskType = slug?.[0];
  const exerciseId = slug?.[1];

  const initialTaskType = rawTaskType && isValidTefTaskType(rawTaskType) ? rawTaskType : undefined;

  return (
    <App
      appConfig={TEF_APP_CONFIG}
      homeHref="/"
      welcomeHref="/tef"
      routeByTask
      initialTaskType={initialTaskType}
      initialExerciseId={initialTaskType ? exerciseId : undefined}
    />
  );
}
