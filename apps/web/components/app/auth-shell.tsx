import Image from 'next/image';
import Link from 'next/link';

interface AuthShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Centered card used by every authentication page. */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl border p-6 shadow-lg sm:p-8">
        <Link href="/" className="mb-4 flex justify-center">
          <Image src="/logo.png" alt="parle-tcf" width={64} height={64} className="h-14 w-14" />
        </Link>
        <h1 className="mb-1 text-center text-lg font-semibold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mb-5 text-center text-sm">{description}</p>
        )}
        {children}
        {footer && <div className="text-muted-foreground mt-5 text-center text-sm">{footer}</div>}
        <p className="text-muted-foreground mt-4 text-center text-xs">
          <Link href="/confidentialite" className="underline">
            Confidentialité
          </Link>
        </p>
      </div>
    </main>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
      {children}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive mb-3 text-sm">
      {message}
    </p>
  );
}
