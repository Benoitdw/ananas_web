<script lang="ts">
  /**
   * Reglage des canaux de notification.
   *
   * Le bouton "Envoyer un test" est la piece essentielle: sans lui, un chat_id
   * errone ne se manifeste que par l'absence silencieuse de notification le
   * lendemain matin.
   */
  import { goto } from '$app/navigation';
  import { api, ApiError } from '$lib/api';
  import TelegramLink from '$lib/components/TelegramLink.svelte';
  import ProfileForm from '$lib/components/ProfileForm.svelte';
  import { authReady, user } from '$lib/stores/auth';
  import type { Channel, ChannelType, Profile } from '$lib/types';

  let channels = $state<Channel[]>([]);
  let types = $state<ChannelType[]>([]);
  let target = $state('');
  let enabled = $state(true);
  let manualOpen = $state(false);
  let loading = $state(true);
  let busy = $state(false);
  let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
  let profile = $state<Profile | null>(null);

  const telegram = $derived(channels.find((c) => c.type === 'telegram') ?? null);
  const serverReady = $derived(types.find((t) => t.type === 'telegram')?.configured ?? false);

  $effect(() => {
    if ($authReady && !$user) goto('/login');
  });

  $effect(() => {
    if (!$authReady || !$user) return;
    Promise.all([
      api.get<Channel[]>('/api/me/channels'),
      api.get<ChannelType[]>('/api/me/channels/types'),
      api.get<Profile>('/api/me/profile')
    ])
      .then(([c, t, p]) => {
        channels = c;
        types = t;
        profile = p;
        const tg = c.find((x) => x.type === 'telegram');
        if (tg) {
          target = tg.target;
          enabled = tg.enabled;
        }
      })
      .catch(() => (message = { kind: 'error', text: 'Chargement impossible.' }))
      .finally(() => (loading = false));
  });

  function report(err: unknown, fallback: string) {
    message = {
      kind: 'error',
      text: err instanceof ApiError ? err.message : fallback
    };
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    message = null;
    try {
      const saved = await api.post<Channel>('/api/me/channels', {
        type: 'telegram',
        target: target.trim(),
        enabled
      });
      channels = [...channels.filter((c) => c.type !== 'telegram'), saved];
      message = { kind: 'ok', text: 'Enregistre.' };
    } catch (err) {
      report(err, 'Enregistrement impossible.');
    } finally {
      busy = false;
    }
  }

  let prefTimer: ReturnType<typeof setTimeout> | undefined;

  /** Le curseur de seuil emet a chaque pixel: on regroupe les envois. */
  function savePreference(patch: Record<string, unknown>) {
    if (profile) profile = { ...profile, ...patch } as Profile;
    clearTimeout(prefTimer);
    prefTimer = setTimeout(async () => {
      try {
        profile = await api.patch<Profile>('/api/me/profile/preferences', patch);
      } catch (err) {
        report(err, 'Enregistrement impossible.');
      }
    }, 400);
  }

  async function saveEnabled() {
    if (!telegram) return;
    try {
      const updated = await api.patch<Channel>(`/api/me/channels/${telegram.id}`, { enabled });
      channels = channels.map((c) => (c.id === updated.id ? updated : c));
    } catch (err) {
      report(err, 'Enregistrement impossible.');
    }
  }

  async function sendTest() {
    if (!telegram) return;
    busy = true;
    message = null;
    try {
      await api.post(`/api/me/channels/${telegram.id}/test`);
      message = { kind: 'ok', text: 'Message de test envoye — regarde ta conversation Telegram.' };
    } catch (err) {
      report(err, 'Envoi impossible.');
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!telegram) return;
    busy = true;
    try {
      await api.del(`/api/me/channels/${telegram.id}`);
      channels = channels.filter((c) => c.type !== 'telegram');
      target = '';
      message = { kind: 'ok', text: 'Canal supprime.' };
    } catch (err) {
      report(err, 'Suppression impossible.');
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Parametres — Ananas</title></svelte:head>

<div class="container page">
  <h1>Parametres</h1>

  {#if loading}
    <p class="muted">Chargement…</p>
  {:else}
    {#if profile}
      <section class="card block">
        <h2>Mon profil professionnel</h2>
        <p class="muted small">
          Ananas compare chaque nouvelle offre a ton profil et lui attribue un score. Ça sert a
          trier tes notifications et a ne voir que les offres qui te concernent.
        </p>

        <ProfileForm {profile} onsaved={(p) => (profile = p)} />
      </section>

      {#if profile.data}
        <section class="card block">
          <h2>Pertinence</h2>

          <div class="field">
            <label for="threshold">
              Seuil de pertinence : <strong>{profile.match_threshold}%</strong>
            </label>
            <input
              id="threshold"
              type="range"
              min="0"
              max="100"
              step="5"
              value={profile.match_threshold}
              oninput={(e) => savePreference({ match_threshold: +e.currentTarget.value })}
            />
            <p class="small muted hint">
              En dessous de ce score, une offre n'est pas consideree comme pertinente.
            </p>
          </div>

          <label class="check">
            <input
              type="checkbox"
              checked={profile.notify_only_relevant}
              onchange={(e) => savePreference({ notify_only_relevant: e.currentTarget.checked })}
            />
            Ne me notifier que les offres pertinentes
          </label>
          <p class="small muted hint">
            Une offre pas encore analysee reste notifiee : mieux vaut un message de trop qu'une
            offre manquee.
          </p>
        </section>
      {/if}
    {/if}

    <section class="card block">
      <h2>Notification Telegram</h2>
      <p class="muted small">
        Ananas t'envoie un message par jour, uniquement s'il y a de nouvelles offres chez les
        entreprises que tu as enregistrees.
      </p>

      {#if !serverReady}
        <p class="alert alert-warn small">
          Le bot n'est pas encore configure cote serveur (<code>TELEGRAM_BOT_TOKEN</code> manquant
          dans le <code>.env</code>). Tu peux enregistrer ton identifiant, mais l'envoi echouera.
        </p>
      {/if}

      {#if telegram}
        <p class="linked small">
          <strong>Telegram connecte.</strong>
          Conversation <code>{telegram.target}</code>.
        </p>

        <label class="check">
          <input
            type="checkbox"
            bind:checked={enabled}
            onchange={() => saveEnabled()}
          />
          Recevoir les notifications quotidiennes
        </label>

        <div class="actions">
          <button class="btn btn-ghost" type="button" onclick={sendTest} disabled={busy}>
            Envoyer un test
          </button>
          <button class="btn btn-ghost danger" type="button" onclick={remove} disabled={busy}>
            Deconnecter
          </button>
        </div>
      {:else}
        <p class="muted small">
          Un appui sur « Demarrer » dans Telegram suffit : c'est le serveur qui reconnait ta
          conversation. Tu n'as aucun identifiant a chercher.
        </p>

        <TelegramLink onlinked={(channel) => { channels = [...channels.filter((c) => c.type !== 'telegram'), channel]; target = channel.target; enabled = channel.enabled; message = { kind: 'ok', text: 'Telegram connecte.' }; }} />

        <details class="how">
          <summary class="small">Saisir un identifiant de conversation a la main</summary>
          <form onsubmit={save}>
            <p class="small muted">
              Utile seulement si tu connais deja ton <code>chat_id</code>, par exemple pour
              envoyer les notifications dans un groupe.
            </p>
            <div class="field">
              <label for="chat">Identifiant de conversation (chat_id)</label>
              <input
                id="chat"
                type="text"
                bind:value={target}
                placeholder="123456789"
                inputmode="numeric"
                required
              />
              <p class="small muted hint">Un nombre entier, negatif s'il s'agit d'un groupe.</p>
            </div>
            <button class="btn btn-ghost" type="submit" disabled={busy}>Enregistrer</button>
          </form>
        </details>
      {/if}

      {#if message}
        <p class="alert alert-{message.kind === 'ok' ? 'ok' : 'error'} small">{message.text}</p>
      {/if}

      {#if telegram?.last_sent_at}
        <p class="small muted">
          Dernier envoi: {new Date(telegram.last_sent_at).toLocaleString('fr-BE')}
        </p>
      {/if}
    </section>

    <section class="card block">
      <h2>Compte</h2>
      <dl>
        <dt>Email</dt>
        <dd>{$user?.email}</dd>
      </dl>
    </section>
  {/if}
</div>

<style>
  .page { padding: 2.2rem 1.25rem 3rem; max-width: 660px; }

  input[type='range'] { width: 100%; accent-color: var(--leaf); }

  h1 { font-size: 1.6rem; margin-bottom: 1.4rem; }

  .block { padding: 1.5rem; margin-bottom: 1rem; }

  @media (max-width: 640px) {
    .block { padding: 1.1rem; }
  }
  .block h2 { font-size: 1.05rem; }

  .linked { margin: 0 0 1rem; }

  .how { margin: 1.2rem 0 0; }
  .how summary { cursor: pointer; color: var(--muted); font-weight: 600; }

  code {
    background: #f0ede4;
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
    font-size: 0.85em;
    /* L'URL getUpdates est plus longue que l'ecran d'un telephone */
    overflow-wrap: anywhere;
  }

  .field { margin-bottom: 0.9rem; }
  .hint { margin: 0.3rem 0 0; }

  .check {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 500;
    margin-bottom: 1.1rem;
  }
  .how form { margin-top: 0.8rem; }
  .check input { width: auto; }

  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .actions .btn { flex: 1 1 auto; }

  .danger { color: var(--danger); }

  .alert { margin: 1rem 0 0; }

  dl {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.3rem 0.8rem;
    margin: 0;
  }
  dt { color: var(--muted); font-weight: 600; }
  dd { margin: 0; }
</style>
