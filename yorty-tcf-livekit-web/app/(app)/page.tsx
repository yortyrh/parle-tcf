import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="from-background to-muted/20 flex min-h-svh flex-col items-center justify-center bg-gradient-to-b p-6 text-center">
      <Image
        src="/logo.png"
        alt="Agent vocal Logo"
        width={128}
        height={128}
        className="mb-6 h-24 w-24 object-contain"
      />
      <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
        Agent Vocal – Expression Orale
      </h1>
      <p className="text-muted-foreground mb-10 max-w-md text-sm sm:text-base">
        Choisissez votre examen pour commencer à pratiquer avec votre agent vocal IA.
      </p>

      <div className="grid w-full max-w-xl grid-cols-1 gap-5 sm:grid-cols-2">
        {/* TCF Card */}
        <Link
          href="/tcf"
          className="group border-border bg-card flex flex-col items-start rounded-2xl border-2 p-6 text-left shadow-sm transition-all duration-200 hover:border-cyan-500 hover:shadow-lg"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-2xl text-cyan-700">
            🎓
          </div>
          <h2 className="mb-1 text-lg font-semibold group-hover:text-cyan-600">TCF</h2>
          <p className="text-muted-foreground text-sm">
            Test de Connaissance du Français — 3 tâches d&apos;expression orale (2 à 5 min chacune)
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-cyan-600">
            Commencer →
          </span>
        </Link>

        {/* TEF Canada Card */}
        <Link
          href="/tef"
          className="group border-border bg-card flex flex-col items-start rounded-2xl border-2 p-6 text-left shadow-sm transition-all duration-200 hover:border-red-500 hover:shadow-lg"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-2xl text-red-700">
            🍁
          </div>
          <h2 className="mb-1 text-lg font-semibold group-hover:text-red-600">TEF Canada</h2>
          <p className="text-muted-foreground text-sm">
            Test d&apos;Évaluation de Français — Section A (5 min) et Section B (10 min) avec
            annonces visuelles
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-red-600">
            Commencer →
          </span>
        </Link>
      </div>
    </main>
  );
}
