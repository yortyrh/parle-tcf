import Link from 'next/link';
import { Brand } from '@/components/app/brand';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { AccountLinks } from '@/components/marketing/account-links';

const SECTIONS = [
  { href: '/#deroulement', label: 'Déroulement' },
  { href: '/#sujets', label: 'Sujets du mois' },
  { href: '/#tarifs', label: 'Tarifs' },
  { href: '/#faq', label: 'FAQ' },
];

/** Public pages: light header with section links, and a footer. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
        <a
          href="#contenu"
          className="bg-primary text-primary-foreground sr-only rounded-full px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Aller au contenu
        </a>
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Brand />
          <nav aria-label="Sections" className="ml-6 hidden items-center gap-1 lg:flex">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-sm font-medium"
              >
                {s.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <AccountLinks />
          </div>
        </div>
      </header>
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            parle-tcf n’est affilié ni à France Éducation international ni à la source des sujets.
            Les niveaux donnés sont indicatifs.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/confidentialite"
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              Confidentialité
            </Link>
            <ThemeToggle className="w-fit" />
          </div>
        </div>
      </footer>
    </div>
  );
}
