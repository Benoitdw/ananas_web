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
  import { authReady, user } from '$lib/stores/auth';
  import type { Channel, ChannelType } from '$lib/types';

  let channels = $state<Channel[]>([]);
  let types = $state<ChannelType[]>([]);
  let target = $state('');
  let enabled = $state(true);
  let loading = $state(true);
  let busy = $state(false);
  let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const telegram = $derived(channels.find((c) => c.type === 'telegram') ?? null);
  const serverReady = $derived(types.find((t) => t.type === 'telegram')?.configured ?? false);

  $effect(() => {
    if ($authReady && !$user) goto('/login');
  });

  $effect(() => {
    if (!$authReady || !$user) return;
    Promise.all([api.get<Channel[]>('/api/me/channels'), api.get<ChannelType[]>('/api/me/channels/types')])
      .then(([c, t]) => {
        channels = c;
        types = t;
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

      <details class="how">
        <summary class="small">Comment trouver mon identifiant de conversation ?</summary>
        <ol class="small muted">
          <li>Ouvre Telegram et envoie un message au bot Ananas (n'importe lequel, « salut » suffit).</li>
          <li>
            Ouvre <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> dans un
            navigateur.
          </li>
          <li>Releve la valeur <code>message.chat.id</code> et colle-la ci-dessous.</li>
        </ol>
      </details>

      <form onsubmit={save}>
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

        <label class="check">
          <input type="checkbox" bind:checked={enabled} />
          Recevoir les notifications quotidiennes
        </label>

        <div class="actions">
          <button class="btn" type="submit" disabled={busy}>Enregistrer</button>
          <button
            class="btn btn-ghost"
            type="button"
            onclick={sendTest}
            disabled={busy || !telegram}
            title={telegram ? '' : 'Enregistre d’abord ton identifiant'}
          >
            Envoyer un test
          </button>
          {#if telegram}
            <button class="btn btn-ghost danger" type="button" onclick={remove} disabled={busy}>
              Supprimer
            </button>
          {/if}
        </div>
      </form>

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
  .page { padding: 2.2rem 1.25rem 3rem; max-width: 620px; }

  h1 { font-size: 1.6rem; margin-bottom: 1.4rem; }

  .block { padding: 1.5rem; margin-bottom: 1rem; }

  @media (max-width: 640px) {
    .block { padding: 1.1rem; }
  }
  .block h2 { font-size: 1.05rem; }

  .how { margin: 1rem 0; }
  .how summary { cursor: pointer; color: var(--muted); font-weight: 600; }
  .how ol { margin: 0.6rem 0 0; padding-left: 1.2rem; }
  .how li { margin-bottom: 0.3rem; }

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
