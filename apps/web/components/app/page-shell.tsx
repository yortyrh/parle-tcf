import Link from 'next/link';

const NAV = [
  { href: '/tcf', label: 'S’entraîner' },
  { href: '/examen', label: 'Examen complet' },
  { href: '/historique', label: 'Historique' },
  { href: '/progression', label: 'Progression' },
  { href: '/parametres', label: 'Paramètres' },
  { href: '/confidentialite', label: 'Confidentialité' },
];

export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <nav aria-label="Navigation principale" className="mb-6 flex flex-wrap gap-4 text-sm">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="text-muted-foreground hover:text-foreground underline"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <main>
        <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
        {children}
      </main>
    </div>
  );
}
