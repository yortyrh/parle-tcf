import Link from 'next/link';

export const metadata = { title: 'Confidentialité · parle-tcf' };

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Confidentialité</h1>

      <section aria-labelledby="donnees" className="space-y-2">
        <h2 id="donnees" className="text-lg font-semibold">
          Ce que nous conservons
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Votre compte : adresse e-mail, nom et mot de passe (haché).</li>
          <li>Vos tentatives : date, durée, tâche, transcription du texte et évaluation.</li>
          <li>
            Votre clé API OpenAI, <strong>chiffrée</strong> (AES-256-GCM). Elle n’est jamais
            renvoyée au navigateur : seuls ses quatre derniers caractères sont affichés.
          </li>
        </ul>
      </section>

      <section aria-labelledby="audio" className="space-y-2">
        <h2 id="audio" className="text-lg font-semibold">
          Audio
        </h2>
        <p className="text-sm">
          Votre voix est envoyée en direct à OpenAI avec votre propre clé pour la conversation. Par
          défaut, seule la transcription est gardée. Si vous activez l’enregistrement audio dans les
          paramètres (facultatif), votre micro est enregistré et stocké de façon privée ; il est
          supprimé avec la tentative, si vous retirez votre consentement ou si vous supprimez votre
          compte.
        </p>
      </section>

      <section aria-labelledby="tiers" className="space-y-2">
        <h2 id="tiers" className="text-lg font-semibold">
          Services tiers
        </h2>
        <p className="text-sm">
          La transcription est envoyée à OpenAI pour être évaluée. Les conditions d’OpenAI
          s’appliquent à ces échanges, facturés sur votre compte OpenAI.
        </p>
      </section>

      <section aria-labelledby="droits" className="space-y-2">
        <h2 id="droits" className="text-lg font-semibold">
          Vos droits
        </h2>
        <p className="text-sm">
          Vous pouvez supprimer une tentative depuis l’historique, retirer votre clé API et
          supprimer votre compte depuis les paramètres : toutes vos données sont alors effacées
          définitivement.
        </p>
      </section>

      <section aria-labelledby="avertissement" className="space-y-2">
        <h2 id="avertissement" className="text-lg font-semibold">
          Avertissement
        </h2>
        <p className="text-sm">
          Les évaluations sont indicatives et non officielles. parle-tcf n’est pas affilié à France
          Éducation international.
        </p>
      </section>

      <Link href="/" className="text-sm underline">
        ← Retour
      </Link>
    </main>
  );
}
