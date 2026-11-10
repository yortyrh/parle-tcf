import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CRITERIA,
  CRITERION_LABELS,
  TASK_DURATIONS,
  type TaskType,
  estimateSessionCost,
} from '@parle-tcf/shared';
import {
  ArrowRightIcon,
  ChatsCircleIcon,
  ClockIcon,
  KeyIcon,
  MicrophoneIcon,
  SealCheckIcon,
} from '@phosphor-icons/react/dist/ssr';
import { DemoLoop } from '@/components/marketing/demo-loop';
import { Button } from '@/components/ui/button';
import { ERROR_STYLES, formatCost } from '@/lib/cefr';
import { getFeaturedExercises } from '@/lib/featured';

export const metadata: Metadata = {
  title: {
    absolute: 'parle-tcf · Entraînement à l’expression orale du TCF avec un examinateur IA',
  },
  description:
    'Passez les trois tâches de l’expression orale du TCF avec un examinateur vocal IA, au temps officiel, et recevez une évaluation CECRL sur cinq critères avec vos phrases corrigées.',
  alternates: { canonical: '/' },
};

export const revalidate = 3600;

const STEPS: { task: TaskType; title: string; text: string }[] = [
  {
    task: 'tache1',
    title: 'Entretien dirigé',
    text: 'Vous vous présentez et répondez aux questions de l’examinateur sur votre vie, vos études, votre travail.',
  },
  {
    task: 'tache2',
    title: 'Exercice en interaction',
    text: 'Vous préparez puis jouez une situation de la vie quotidienne : vous posez les questions pour obtenir des informations.',
  },
  {
    task: 'tache3',
    title: 'Expression d’un point de vue',
    text: 'Vous défendez une opinion sur un sujet de société, avec des arguments et des exemples.',
  },
];

function minutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`;
}

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const FAQ = [
  {
    q: 'Faut-il payer un abonnement ?',
    a: 'Non. Vous utilisez votre propre clé API OpenAI ou Gemini : le fournisseur vous facture directement, à la minute de conversation. Des limites quotidiennes et mensuelles évitent les mauvaises surprises.',
  },
  {
    q: 'Ma clé API est-elle en sécurité ?',
    a: 'Elle est chiffrée sur le serveur (AES-256-GCM) et n’est jamais renvoyée au navigateur. Chaque session utilise un jeton temporaire créé pour elle.',
  },
  {
    q: 'Le niveau obtenu est-il officiel ?',
    a: 'Non. C’est une estimation CECRL indicative, fondée sur une grille de cinq critères. Elle sert à repérer vos points faibles, pas à remplacer l’examen.',
  },
  {
    q: 'D’où viennent les sujets ?',
    a: 'Des sujets d’expression orale publiés chaque mois par reussir-tcfcanada.com, regroupés et dédoublonnés. parle-tcf n’est pas affilié à ce site.',
  },
  {
    q: 'Ma voix est-elle enregistrée ?',
    a: 'Par défaut, seule la transcription est conservée. L’enregistrement audio est facultatif, demande votre accord et peut être supprimé à tout moment.',
  },
];

export default async function LandingPage() {
  const featured = await getFeaturedExercises();
  const costs = STEPS.map(
    (s) => estimateSessionCost('gpt-realtime-mini', TASK_DURATIONS[s.task].speakingS) ?? 0
  );
  const examCost = costs.reduce((a, b) => a + b, 0);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,oklch(0.45_0.11_235/12%),transparent),radial-gradient(40rem_20rem_at_0%_100%,oklch(0.64_0.19_35/10%),transparent)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="text-primary mb-4 text-sm font-semibold tracking-widest uppercase">
              TCF · Expression orale
            </p>
            <h1 className="font-display text-headline sm:text-display">
              Entraînez-vous à l’expression orale du TCF avec un{' '}
              <span className="text-highlight italic">examinateur IA</span>
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-lg">
              Les trois tâches, au temps officiel, à voix haute. Après chaque passage : un niveau
              CECRL sur cinq critères et vos phrases corrigées une à une.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href="/inscription">
                  Commencer gratuitement <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="#deroulement">Voir le déroulement</Link>
              </Button>
            </div>
            <ul className="text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <li className="flex items-center gap-2">
                <MicrophoneIcon className="text-primary size-4" aria-hidden /> Conversation vocale
                en direct
              </li>
              <li className="flex items-center gap-2">
                <KeyIcon className="text-primary size-4" aria-hidden /> Votre clé, sans abonnement
              </li>
            </ul>
          </div>
          <DemoLoop />
        </div>
      </section>

      {/* How it works */}
      <section id="deroulement" className="scroll-mt-20 border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="font-display text-headline max-w-2xl">
            Comme le jour de l’épreuve, en douze minutes
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            L’examinateur suit le déroulement officiel et le chronomètre clôt chaque tâche. Vous
            pouvez aussi travailler une tâche seule, autant de fois que nécessaire.
          </p>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => {
              const { preparationS, speakingS } = TASK_DURATIONS[step.task];
              return (
                <li
                  key={step.task}
                  className="bg-card shadow-card flex flex-col gap-3 rounded-2xl border p-6"
                >
                  <span className="font-display text-highlight text-4xl leading-none">{i + 1}</span>
                  <h3 className="font-display text-title">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.text}</p>
                  <p className="mt-auto flex items-center gap-2 pt-2 text-sm font-medium">
                    <ClockIcon className="text-primary size-4" aria-hidden />
                    {preparationS > 0 && `${minutes(preparationS)} de préparation + `}
                    {minutes(speakingS)}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-title flex items-center gap-2">
                <SealCheckIcon className="text-primary size-6" aria-hidden /> Une évaluation sur
                cinq critères
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Un correcteur relit la transcription et attribue un niveau de A1 à C2 à chaque
                critère, avec un commentaire, puis un niveau global.
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {CRITERIA.map((c, i) => (
                  <li key={c} className="flex items-center gap-3 text-sm">
                    <span className="w-48 shrink-0">{CRITERION_LABELS[c]}</span>
                    <span className="bg-muted h-2 flex-1 overflow-hidden rounded-full" aria-hidden>
                      <span
                        className="bg-primary block h-full rounded-full"
                        style={{ width: `${[67, 50, 67, 50, 83][i]}%` }}
                      />
                    </span>
                    <span className="w-6 text-right font-semibold">
                      {['B2', 'B1', 'B2', 'B1', 'C1'][i]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-display text-title flex items-center gap-2">
                <ChatsCircleIcon className="text-primary size-6" aria-hidden /> Vos phrases,
                corrigées
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Chaque erreur est surlignée et expliquée : grammaire, lexique, syntaxe ou registre.
              </p>
              <figure className="bg-card shadow-card mt-4 rounded-2xl border p-5 text-sm">
                <p>
                  « Hier, j’ai{' '}
                  <mark className={`${ERROR_STYLES.grammaire} rounded px-0.5 text-inherit`}>
                    allé
                  </mark>{' '}
                  au marché et j’ai{' '}
                  <mark className={`${ERROR_STYLES.lexique} rounded px-0.5 text-inherit`}>
                    pris
                  </mark>{' '}
                  une décision{' '}
                  <mark className={`${ERROR_STYLES.registre} rounded px-0.5 text-inherit`}>
                    super cool
                  </mark>
                  . »
                </p>
                <p className="text-success mt-3 font-medium">
                  → « Hier, je suis allé au marché et j’ai pris une décision très intéressante. »
                </p>
                <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
                  <li>
                    <strong className="text-foreground">Grammaire :</strong> « aller » se conjugue
                    avec « être ».
                  </li>
                  <li>
                    <strong className="text-foreground">Registre :</strong> « super cool » est trop
                    familier à l’oral d’examen.
                  </li>
                </ul>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* Subjects of the month */}
      <section id="sujets" className="bg-secondary/50 scroll-mt-20 border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="font-display text-headline">
            Sujets du mois
            {featured?.session && (
              <span className="text-muted-foreground">
                {' '}
                · {MONTHS[featured.session.month - 1]} {featured.session.year}
              </span>
            )}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Les sujets publiés récemment, à travailler dès votre première session.
          </p>
          {featured && featured.items.length > 0 ? (
            <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featured.items.map((item) => (
                <li key={item.id} className="bg-card flex flex-col gap-3 rounded-2xl border p-5">
                  <span className="bg-primary/10 text-primary w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    Tâche {item.task}
                  </span>
                  <p className="line-clamp-5 text-sm">{item.prompt}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-8 text-sm">
              Les sujets du mois seront affichés ici dès qu’ils seront disponibles.
            </p>
          )}
          <p className="text-muted-foreground mt-6 text-xs">
            Source des sujets :{' '}
            <a
              href="https://reussir-tcfcanada.com/expression-orale/"
              className="underline"
              rel="noopener noreferrer"
            >
              reussir-tcfcanada.com
            </a>
            . parle-tcf n’est pas affilié à ce site.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="tarifs" className="scroll-mt-20 border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h2 className="font-display text-headline">
              Pas d’abonnement : votre clé, vos minutes
            </h2>
            <p className="text-muted-foreground mt-3">
              parle-tcf ne revend rien. Vous ajoutez votre clé API OpenAI ou Gemini, et le
              fournisseur facture la conversation directement sur votre compte.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <li>· Clé chiffrée, jamais renvoyée au navigateur.</li>
              <li>· Plafonds quotidiens et mensuels pour garder le contrôle.</li>
              <li>· Coût estimé affiché pour chaque passage dans l’historique.</li>
            </ul>
          </div>
          <div className="bg-card shadow-card rounded-2xl border p-6">
            <p className="text-sm font-semibold">Coût indicatif avec gpt-realtime-mini</p>
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">Coût estimé par tâche</caption>
              <tbody>
                {STEPS.map((s, i) => (
                  <tr key={s.task} className="border-b last:border-0">
                    <th scope="row" className="py-2 text-left font-normal">
                      Tâche {i + 1} · {s.title}
                    </th>
                    <td className="py-2 text-right tabular-nums">≈ {formatCost(costs[i]!)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="pt-3 text-left font-semibold">
                    Examen complet
                  </th>
                  <td className="pt-3 text-right font-semibold tabular-nums">
                    ≈ {formatCost(examCost)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-muted-foreground mt-4 text-xs">
              Estimation de la conversation seule, hors correction ; les tarifs du fournisseur
              peuvent changer.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="font-display text-headline">Questions fréquentes</h2>
          <div className="mt-8 divide-y rounded-2xl border">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span
                      aria-hidden
                      className="text-primary transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="text-muted-foreground mt-3 text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
          <h2 className="font-display text-headline max-w-2xl">
            Votre prochaine session commence dans deux minutes
          </h2>
          <Button asChild variant="primary" size="lg">
            <Link href="/inscription">
              Créer mon compte <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
