import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AttemptDetail, CRITERION_LABELS, EVALUATION_DISCLAIMER } from '@parle-tcf/shared';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { ResultView } from './result-view';

vi.mock('@/lib/api', () => ({
  api: { getAttempt: vi.fn(), getAudioDownloadUrl: vi.fn(), reevaluateAttempt: vi.fn() },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/resultats/att-1',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }), signOut: vi.fn() },
}));

const getAttempt = vi.mocked(api.getAttempt);
const getAudio = vi.mocked(api.getAudioDownloadUrl);
const reevaluate = vi.mocked(api.reevaluateAttempt);

const EVALUATION: NonNullable<AttemptDetail['evaluation']> = {
  globalLevel: 'B2',
  summary: 'Bonne aisance, quelques erreurs d’accord.',
  correctorModel: 'gpt',
  rubricVersion: 'v1',
  criteria: {
    adequation: { level: 'B2', comment: 'Tâche réalisée.' },
    coherence: { level: 'B1', comment: 'Connecteurs simples.' },
    vocabulaire: { level: 'C1', comment: 'Riche.' },
    grammaire: { level: 'A2', comment: 'Accords à revoir.' },
    aisance: { level: 'C2', comment: 'Très fluide.' },
  },
};

function attempt(overrides: Partial<AttemptDetail> = {}): AttemptDetail {
  return {
    id: 'att-1',
    runId: null,
    mode: 'practice',
    task: 2,
    exerciseId: 'ex-1',
    status: 'completed',
    evaluationStatus: 'done',
    startedAt: '2026-03-01T10:00:00Z',
    finishedAt: '2026-03-01T10:04:00Z',
    durationS: 125,
    model: 'gpt-realtime-mini',
    globalLevel: 'B2',
    estimatedCostUsd: 0.1,
    exercisePrompt: 'Vous cherchez un logement.',
    realtimeMinutes: 2,
    evaluation: EVALUATION,
    transcript: [
      { seq: 0, speaker: 'examiner', text: 'Bonjour.', correctedText: null, errors: null },
      {
        seq: 1,
        speaker: 'candidate',
        text: 'Je cherche un appartement.',
        correctedText: 'Je cherche un appartement.',
        errors: [],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  getAttempt.mockReset();
  getAudio.mockReset();
  reevaluate.mockReset();
  getAudio.mockResolvedValue({ url: null });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ResultView', () => {
  it('shows a placeholder while loading', () => {
    getAttempt.mockReturnValue(new Promise(() => undefined));
    render(<ResultView attemptId="att-1" />);
    expect(screen.getByRole('heading', { name: 'Résultat' })).toBeInTheDocument();
    expect(screen.getAllByRole('status', { name: 'Chargement' }).length).toBeGreaterThan(0);
  });

  it('shows the load error and retries', async () => {
    getAttempt.mockRejectedValueOnce(new Error('Tentative introuvable.'));
    getAttempt.mockResolvedValue(attempt());
    render(<ResultView attemptId="att-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Tentative introuvable.');
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { name: 'Niveau global' })).toBeInTheDocument();
    expect(getAttempt).toHaveBeenCalledTimes(2);
  });

  it('shows the task, date, duration and cost, and offers to redo the subject', async () => {
    getAttempt.mockResolvedValue(attempt());
    render(<ResultView attemptId="att-1" />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tâche 2 · Interaction' })
    ).toBeInTheDocument();
    expect(screen.getByText(/durée 2 min 05 s · coût estimé 0,10 \$/)).toBeInTheDocument();
    expect(screen.getByText(/1 mars 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Refaire ce sujet' })).toHaveAttribute(
      'href',
      '/tcf/tache2/ex-1'
    );
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Historique' })
    ).toHaveAttribute('href', '/historique');
  });

  it.each([
    ['tâche 1', { task: 1 }],
    ['without a subject', { exerciseId: null }],
  ])('does not offer to redo the subject for %s', async (_label, overrides) => {
    getAttempt.mockResolvedValue(attempt(overrides));
    render(<ResultView attemptId="att-1" />);
    await screen.findByRole('heading', { name: 'Niveau global' });
    expect(screen.queryByRole('link', { name: 'Refaire ce sujet' })).not.toBeInTheDocument();
  });

  it('shows the overall level, the summary and one meter per criterion', async () => {
    getAttempt.mockResolvedValue(attempt());
    render(<ResultView attemptId="att-1" />);

    const section = (await screen.findByRole('heading', { name: 'Niveau global' })).closest(
      'section'
    )!;
    expect(within(section).getAllByLabelText('Niveau B2')[0]).toHaveTextContent('B2');
    expect(within(section).getByText(EVALUATION.summary)).toBeInTheDocument();

    const meters = within(section).getAllByRole('meter');
    expect(meters.map((m) => m.getAttribute('aria-label'))).toEqual([
      `${CRITERION_LABELS.adequation} : B2`,
      `${CRITERION_LABELS.coherence} : B1`,
      `${CRITERION_LABELS.vocabulaire} : C1`,
      `${CRITERION_LABELS.grammaire} : A2`,
      `${CRITERION_LABELS.aisance} : C2`,
    ]);
    expect(meters.map((m) => m.getAttribute('aria-valuenow'))).toEqual(['4', '3', '5', '2', '6']);
    expect(meters[4]).toHaveAttribute('aria-valuemin', '1');
    expect(meters[4]).toHaveAttribute('aria-valuemax', '6');
    expect(meters[4]).toHaveAttribute('aria-valuetext', 'C2');
    expect((meters[4].firstElementChild as HTMLElement).style.width).toBe('100%');
    expect(within(section).getByText('Accords à revoir.')).toBeInTheDocument();
    expect(within(section).getByText(EVALUATION_DISCLAIMER)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Vos phrases corrigées' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Légende des erreurs' })).toBeInTheDocument();
    expect(screen.getByText('Version corrigée')).toBeInTheDocument();
  });

  it.each(['pending', 'running'] as const)(
    'says the evaluation is in progress (%s) and shows the raw transcript',
    async (evaluationStatus) => {
      getAttempt.mockResolvedValue(attempt({ evaluationStatus, evaluation: null }));
      render(<ResultView attemptId="att-1" />);

      expect(
        await screen.findByText('Évaluation en cours… cette page se met à jour automatiquement.')
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Transcription' })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Légende des erreurs' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Niveau global' })).not.toBeInTheDocument();
      expect(screen.getByText('Je cherche un appartement.')).toBeInTheDocument();
    }
  );

  it('offers to rerun a failed evaluation', async () => {
    getAttempt
      .mockResolvedValueOnce(attempt({ evaluationStatus: 'failed', evaluation: null }))
      .mockResolvedValue(attempt({ evaluationStatus: 'pending', evaluation: null }));
    let finish!: () => void;
    reevaluate.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ ok: true });
      })
    );
    render(<ResultView attemptId="att-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'L’évaluation a échoué. Votre transcription est conservée.'
    );
    expect(screen.queryByText(/Évaluation en cours/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Relancer l’évaluation' }));
    expect(reevaluate).toHaveBeenCalledWith('att-1');
    expect(screen.getByRole('button', { name: 'Relance…' })).toBeDisabled();

    finish();
    expect(
      await screen.findByText('Évaluation en cours… cette page se met à jour automatiquement.')
    ).toBeInTheDocument();
    expect(getAttempt).toHaveBeenCalledTimes(2);
  });

  describe('when the rerun request fails', () => {
    const RETRY_ERROR = 'La relance de l’évaluation a échoué. Réessayez dans un instant.';
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };

    beforeEach(() => {
      unhandled.length = 0;
      process.on('unhandledRejection', onUnhandled);
    });

    afterEach(() => {
      process.off('unhandledRejection', onUnhandled);
    });

    function retryAlert() {
      return screen.queryAllByRole('alert').find((el) => el.textContent?.includes(RETRY_ERROR));
    }

    it('shows an alert, re-enables the button and leaves no unhandled rejection', async () => {
      getAttempt.mockResolvedValue(attempt({ evaluationStatus: 'failed', evaluation: null }));
      reevaluate.mockRejectedValue(new Error('500'));
      render(<ResultView attemptId="att-1" />);

      await userEvent.click(await screen.findByRole('button', { name: 'Relancer l’évaluation' }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      await waitFor(() => expect(retryAlert()).toBeDefined());
      expect(screen.getByRole('button', { name: 'Relancer l’évaluation' })).toBeEnabled();
      expect(unhandled).toEqual([]);
    });

    it('clears the message once a later rerun succeeds', async () => {
      getAttempt
        .mockResolvedValueOnce(attempt({ evaluationStatus: 'failed', evaluation: null }))
        .mockResolvedValue(attempt({ evaluationStatus: 'pending', evaluation: null }));
      reevaluate.mockRejectedValueOnce(new Error('500')).mockResolvedValue({ ok: true });
      render(<ResultView attemptId="att-1" />);

      await userEvent.click(await screen.findByRole('button', { name: 'Relancer l’évaluation' }));
      await waitFor(() => expect(retryAlert()).toBeDefined());

      await userEvent.click(screen.getByRole('button', { name: 'Relancer l’évaluation' }));

      expect(
        await screen.findByText('Évaluation en cours… cette page se met à jour automatiquement.')
      ).toBeInTheDocument();
      expect(retryAlert()).toBeUndefined();
      expect(reevaluate).toHaveBeenCalledTimes(2);
    });
  });

  it('plays back the recording when there is one', async () => {
    getAttempt.mockResolvedValue(attempt());
    getAudio.mockResolvedValue({ url: 'https://bucket.example/a.webm' });
    const { container } = render(<ResultView attemptId="att-1" />);

    expect(
      await screen.findByRole('region', { name: "Réécouter l'enregistrement" })
    ).toBeInTheDocument();
    expect(container.querySelector('audio')).toHaveAttribute(
      'src',
      'https://bucket.example/a.webm'
    );
    expect(getAudio).toHaveBeenCalledWith('att-1');
  });

  it.each([
    ['there is no recording', () => getAudio.mockResolvedValue({ url: null })],
    ['the recording cannot load', () => getAudio.mockRejectedValue(new Error('403'))],
  ])('has no player when %s', async (_label, arrange) => {
    arrange();
    getAttempt.mockResolvedValue(attempt());
    const { container } = render(<ResultView attemptId="att-1" />);
    await screen.findByRole('heading', { name: 'Niveau global' });
    expect(container.querySelector('audio')).toBeNull();
  });
});
