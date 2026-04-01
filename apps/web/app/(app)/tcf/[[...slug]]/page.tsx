import { APP_CONFIG_DEFAULTS } from '@/app-config';
import { App } from '@/components/app/app';

const VALID_TASK_TYPES = ['tache1', 'tache2', 'tache3'] as const;
type ValidTaskType = (typeof VALID_TASK_TYPES)[number];

function isValidTaskType(value: string): value is ValidTaskType {
  return VALID_TASK_TYPES.includes(value as ValidTaskType);
}

interface TCFPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function TCFPage({ params }: TCFPageProps) {
  const { slug } = await params;

  const rawTaskType = slug?.[0];
  const exerciseId = slug?.[1];

  const initialTaskType = rawTaskType && isValidTaskType(rawTaskType) ? rawTaskType : undefined;

  return (
    <App
      appConfig={APP_CONFIG_DEFAULTS}
      homeHref="/"
      welcomeHref="/tcf"
      routeByTask
      initialTaskType={initialTaskType}
      initialExerciseId={initialTaskType ? exerciseId : undefined}
    />
  );
}
