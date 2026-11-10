'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AudioStatus, ProviderSettings } from '@parle-tcf/shared';
import { FieldLabel, FormError } from '@/components/app/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { formText } from '@/lib/form';
import { clearSessionToken } from '@/lib/session-token';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export function ParametresView() {
  const router = useRouter();
  const welcome = useSearchParams().get('bienvenue') === '1';
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [audio, setAudio] = useState<AudioStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const loaded = await api.getSettings();
      setSettings(loaded);
      setProvider(loaded.provider);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void load();
    api.getAudioStatus().then(setAudio, () => undefined);
  }, [load]);

  async function run<T>(action: () => Promise<T>, success?: (value: T) => Notice) {
    setBusy(true);
    setNotice(null);
    try {
      const value = await action();
      if (success) setNotice(success(value));
    } catch (e) {
      setNotice({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Une erreur est survenue.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const apiKey = formText(form, 'apiKey').trim();
    await run(
      async () => {
        const saved = await api.saveSettings({
          provider,
          ...(apiKey ? { apiKey } : {}),
          realtimeModel: formText(form, 'realtimeModel').trim() || null,
          voice: formText(form, 'voice').trim() || null,
          textModel: formText(form, 'textModel').trim() || null,
        });
        formEl.reset();
        setSettings(saved);
        return saved;
      },
      () => ({
        kind: 'ok',
        text: 'Paramètres enregistrés. Testez la connexion pour valider la clé.',
      })
    );
  }

  async function onTest() {
    await run(
      async () => {
        const result = await api.testSettings();
        await load();
        return result;
      },
      (result) =>
        result.ok
          ? { kind: 'ok', text: 'Connexion réussie : la clé fonctionne.' }
          : { kind: 'error', text: result.message ?? 'La clé a été refusée.' }
    );
  }

  async function onDeleteKey() {
    if (!window.confirm('Supprimer votre clé API ? Vous ne pourrez plus lancer de session.'))
      return;
    await run(
      async () => {
        await api.deleteSettings();
        await load();
      },
      () => ({ kind: 'ok', text: 'Clé supprimée.' })
    );
  }

  async function onAudioConsent(consent: boolean) {
    await run(
      async () => setAudio(await api.setAudioConsent(consent)),
      () => ({
        kind: 'ok',
        text: consent
          ? 'Enregistrement audio activé pour vos prochaines tentatives.'
          : 'Enregistrement désactivé : vos enregistrements existants ont été supprimés.',
      })
    );
  }

  async function onSignOut() {
    await authClient.signOut().catch(() => null);
    clearSessionToken();
    router.replace('/connexion');
    router.refresh();
  }

  // Deletion is always confirmed by email (works for GitHub/Google accounts without a password).
  async function onDeleteAccount() {
    await run(
      async () => {
        const { error } = await authClient.deleteUser({});
        if (error) throw new Error("Impossible d'envoyer l'e-mail de confirmation. Réessayez.");
      },
      () => ({
        kind: 'ok',
        text: 'Un e-mail de confirmation vous a été envoyé : ouvrez le lien pour supprimer définitivement votre compte.',
      })
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <FormError message={loadError} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Paramètres</h1>
        <Link href="/tcf" className="text-primary text-sm underline">
          ← Retour aux exercices
        </Link>
      </header>

      {welcome && (
        <p role="status" className="bg-primary/10 rounded-lg p-3 text-sm">
          Bienvenue ! Pour démarrer un entraînement, ajoutez votre clé API OpenAI ci-dessous.
        </p>
      )}

      <section
        className="bg-card flex flex-col gap-4 rounded-2xl border p-5"
        aria-labelledby="cle-api"
      >
        <div>
          <h2 id="cle-api" className="font-medium">
            Clé API {provider === 'gemini' ? 'Gemini' : 'OpenAI'}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Elle est chiffrée côté serveur et ne vous est jamais renvoyée. Les sessions vocales sont
            facturées sur votre compte {provider === 'gemini' ? 'Google AI' : 'OpenAI'}.
          </p>
        </div>

        {settings === null ? (
          <p className="text-muted-foreground text-sm">Chargement…</p>
        ) : (
          <>
            <p className="text-sm" data-testid="key-status">
              {settings.configured ? (
                <>
                  Clé enregistrée :{' '}
                  <span className="font-mono">
                    {settings.provider === 'gemini' ? 'AIza' : 'sk-'}…{settings.last4}
                  </span>{' '}
                  ·{' '}
                  {settings.verifiedAt
                    ? `vérifiée le ${new Date(settings.verifiedAt).toLocaleString('fr-FR')}`
                    : 'pas encore vérifiée'}
                </>
              ) : (
                'Aucune clé enregistrée.'
              )}
            </p>

            <form onSubmit={onSave} className="flex flex-col gap-3">
              <div>
                <FieldLabel htmlFor="provider">Fournisseur</FieldLabel>
                <select
                  id="provider"
                  className="bg-background w-full rounded-md border p-2 text-sm"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'openai' | 'gemini')}
                >
                  <option value="openai">OpenAI (Realtime)</option>
                  <option value="gemini">Google Gemini (Live) — expérimental</option>
                </select>
                {settings.configured && provider !== settings.provider && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Changer de fournisseur nécessite de saisir une nouvelle clé.
                  </p>
                )}
              </div>
              <div>
                <FieldLabel htmlFor="apiKey">
                  {settings.configured ? 'Remplacer la clé (optionnel)' : 'Clé API'}
                </FieldLabel>
                <Input
                  id="apiKey"
                  name="apiKey"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={provider === 'gemini' ? 'AIza…' : 'sk-…'}
                  required={!settings.configured || provider !== settings.provider}
                />
              </div>
              <details className="text-sm">
                <summary className="text-muted-foreground cursor-pointer">Options avancées</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <div>
                    <FieldLabel htmlFor="realtimeModel">Modèle vocal (Realtime)</FieldLabel>
                    <Input
                      id="realtimeModel"
                      name="realtimeModel"
                      defaultValue={settings.realtimeModel ?? ''}
                      placeholder={
                        provider === 'gemini'
                          ? 'gemini-2.5-flash-native-audio-preview-09-2025'
                          : 'gpt-realtime-mini'
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="voice">Voix</FieldLabel>
                    <Input
                      id="voice"
                      name="voice"
                      defaultValue={settings.voice ?? ''}
                      placeholder={provider === 'gemini' ? 'Puck' : 'marin'}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="textModel">Modèle texte (évaluation)</FieldLabel>
                    <Input
                      id="textModel"
                      name="textModel"
                      defaultValue={settings.textModel ?? ''}
                      placeholder={provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4.1-mini'}
                    />
                  </div>
                </div>
              </details>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={busy}>
                  Enregistrer
                </Button>
                {settings.configured && (
                  <>
                    <Button type="button" onClick={onTest} disabled={busy}>
                      Tester la connexion
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={onDeleteKey}
                      disabled={busy}
                    >
                      Supprimer la clé
                    </Button>
                  </>
                )}
              </div>
            </form>
          </>
        )}

        {notice && (
          <p
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={notice.kind === 'error' ? 'text-destructive text-sm' : 'text-sm'}
          >
            {notice.text}
          </p>
        )}
      </section>

      {audio?.available && (
        <section
          aria-labelledby="audio"
          className="bg-card flex flex-col gap-3 rounded-xl border p-4"
        >
          <h2 id="audio" className="font-medium">
            Enregistrement audio
          </h2>
          <p className="text-muted-foreground text-sm">
            Facultatif. Si vous l&apos;activez, votre micro est enregistré pendant chaque tentative
            afin que vous puissiez vous réécouter. Les enregistrements sont privés, supprimés avec
            la tentative ou le compte, et tous effacés si vous désactivez l&apos;option.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={audio.consent}
              disabled={busy}
              onChange={(e) => void onAudioConsent(e.target.checked)}
            />
            J&apos;accepte l&apos;enregistrement de ma voix
          </label>
        </section>
      )}

      <section
        className="bg-card flex flex-col gap-3 rounded-2xl border p-5"
        aria-labelledby="compte"
      >
        <h2 id="compte" className="font-medium">
          Compte
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSignOut} disabled={busy}>
            Se déconnecter
          </Button>
          <Button type="button" variant="destructive" onClick={onDeleteAccount} disabled={busy}>
            Supprimer mon compte
          </Button>
        </div>
      </section>
    </main>
  );
}
