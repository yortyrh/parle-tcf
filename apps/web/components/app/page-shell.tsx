import { AppHeader } from '@/components/app/app-shell';

interface PageShellProps {
  title: string;
  /** One line under the title. */
  description?: React.ReactNode;
  /** Buttons aligned with the title (right on wide screens). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Every signed-in page except the live session: app header, then a titled content column. */
export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main id="contenu" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-headline">{title}</h1>
            {description && <p className="text-muted-foreground mt-2 max-w-prose">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
