/**
 * Illustrative Tâche 2 result for the README screenshots: the fake corrector only echoes
 * "Évaluation simulée", so the capture swaps the attempt's evaluation and transcript for this
 * one (a plausible exchange on the sample subject "salle de sport", graded like the real
 * corrector would). Screenshot data only; nothing here reaches the API.
 */
type ErrorType = 'grammaire' | 'lexique' | 'syntaxe' | 'registre';
type Line =
  | { speaker: 'examiner'; text: string }
  | {
      speaker: 'candidate';
      text: string;
      corrected?: string;
      errors?: { excerpt: string; type: ErrorType; explanation: string }[];
    };

const LINES: Line[] = [
  {
    speaker: 'examiner',
    text: 'Bonjour, bienvenue au club. Je suis le responsable de la salle. Je vous écoute.',
  },
  {
    speaker: 'candidate',
    text: 'Bonjour, je voudrais m’inscrire à la salle. Quels sont les horaires d’ouverture ?',
  },
  {
    speaker: 'examiner',
    text: 'Nous sommes ouverts de 6 h à 22 h en semaine, et de 8 h à 20 h le week-end.',
  },
  {
    speaker: 'candidate',
    text: 'Je travaille beaucoup pendant la semaine, alors je suis libre que le samedi et le dimanche.',
    corrected:
      'Je travaille beaucoup pendant la semaine, alors je ne suis libre que le samedi et le dimanche.',
    errors: [
      {
        excerpt: 'je suis libre que',
        type: 'grammaire',
        explanation: 'La restriction « ne… que » garde le « ne » : « je ne suis libre que ».',
      },
    ],
  },
  {
    speaker: 'examiner',
    text: 'Aucun problème, tous les cours collectifs ont aussi lieu le week-end.',
  },
  {
    speaker: 'candidate',
    text: 'Quels cours vous proposez ? J’aime le yoga, mais je n’ai jamais fait de la natation.',
    corrected: 'Quels cours proposez-vous ? J’aime le yoga, mais je n’ai jamais fait de natation.',
    errors: [
      {
        excerpt: 'Quels cours vous proposez',
        type: 'syntaxe',
        explanation:
          'Avec « quels », l’interrogation soutenue inverse le sujet : « proposez-vous ».',
      },
      {
        excerpt: 'fait de la natation',
        type: 'grammaire',
        explanation: 'Après une négation, l’article partitif devient « de » : « pas de natation ».',
      },
    ],
  },
  {
    speaker: 'examiner',
    text: 'Du yoga, du pilates, de l’aquagym et des cours de natation pour débutants.',
  },
  {
    speaker: 'candidate',
    text: 'Parfait. Et l’abonnement, il coûte combien ? Est-ce qu’il faut amener quelque chose pour le premier cours ?',
    corrected:
      'Parfait. Et l’abonnement, combien coûte-t-il ? Est-ce qu’il faut apporter quelque chose pour le premier cours ?',
    errors: [
      {
        excerpt: 'il coûte combien',
        type: 'registre',
        explanation: 'Tournure familière ; à l’oral d’examen, préférez « combien coûte-t-il ? ».',
      },
      {
        excerpt: 'amener',
        type: 'lexique',
        explanation: 'On « amène » une personne, on « apporte » un objet.',
      },
    ],
  },
  {
    speaker: 'examiner',
    text: 'Trente-cinq euros par mois. Prenez simplement une serviette et un maillot de bain.',
  },
  {
    speaker: 'candidate',
    text: 'Très bien, merci beaucoup. Je vais réfléchir et je reviendrai m’inscrire samedi.',
  },
];

function transcript() {
  return LINES.map((line, seq) => {
    if (line.speaker === 'examiner') {
      return { seq, speaker: line.speaker, text: line.text, correctedText: null, errors: null };
    }
    const errors = (line.errors ?? []).map(({ excerpt, type, explanation }) => {
      const start = line.text.indexOf(excerpt);
      if (start < 0) throw new Error(`"${excerpt}" is not in "${line.text}"`);
      return { start, end: start + excerpt.length, type, explanation };
    });
    return {
      seq,
      speaker: line.speaker,
      text: line.text,
      correctedText: line.corrected ?? line.text,
      errors,
    };
  });
}

const EVALUATION = {
  globalLevel: 'B2',
  criteria: {
    adequation: {
      level: 'B2',
      comment:
        'Toutes les informations utiles sont obtenues (horaires, cours, prix, matériel) et l’échange se conclut naturellement.',
    },
    coherence: {
      level: 'B2',
      comment:
        'Questions bien enchaînées, avec des connecteurs simples (« alors », « mais ») qui relient vos besoins à vos questions.',
    },
    vocabulaire: {
      level: 'B1',
      comment:
        'Lexique adapté à la situation, avec quelques confusions d’usage (« amener » pour « apporter »).',
    },
    grammaire: {
      level: 'B1',
      comment:
        'Phrases correctes dans l’ensemble ; la négation (« ne… que », « pas de ») reste à consolider.',
    },
    aisance: {
      level: 'B2',
      comment: 'Débit régulier et peu d’hésitations ; les reformulations restent rares.',
    },
  },
  summary:
    'Interaction efficace : vous obtenez ce dont vous avez besoin. Travaillez la négation et les questions avec inversion pour viser un B2 solide.',
  correctorModel: 'gpt-6-luna',
  rubricVersion: 'v1',
};

/** Replaces the evaluation side of an attempt detail, keeping ids and dates. */
export function withDemoEvaluation<T extends Record<string, unknown>>(detail: T): T {
  return {
    ...detail,
    durationS: 214,
    realtimeMinutes: 3.6,
    estimatedCostUsd: 0.07,
    globalLevel: EVALUATION.globalLevel,
    evaluation: { ...EVALUATION, rubricVersion: readRubric(detail) },
    transcript: transcript(),
  };
}

/** The same level on an attempt summary (dashboard, history), so the pages agree. */
export function withDemoLevel<T extends Record<string, unknown>>(summary: T): T {
  return {
    ...summary,
    durationS: 214,
    estimatedCostUsd: 0.07,
    globalLevel: EVALUATION.globalLevel,
  };
}

function readRubric(detail: Record<string, unknown>): string {
  const evaluation = detail.evaluation as { rubricVersion?: string } | null | undefined;
  return evaluation?.rubricVersion ?? EVALUATION.rubricVersion;
}
