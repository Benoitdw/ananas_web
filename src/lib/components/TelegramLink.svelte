<script lang="ts">
  /**
   * Liaison du compte a une conversation Telegram.
   *
   * Un bot Telegram ne peut pas ecrire a quelqu'un qui ne lui a jamais parle:
   * l'initiative vient donc de l'utilisateur. Et le token du bot ne doit
   * jamais lui etre communique — c'est un secret serveur partage par tous les
   * comptes. D'ou le lien profond a usage unique: un appui sur "Demarrer"
   * suffit, le serveur reconnait le code et enregistre la conversation.
   */
  import qrcode from 'qrcode-generator';
  import { api, ApiError } from '$lib/api';
  import type { Channel, TelegramLink, TelegramLinkStatus } from '$lib/types';

  type Props = { onlinked: (channel: Channel) => void };
  let { onlinked }: Props = $props();

  let link = $state<TelegramLink | null>(null);
  let busy = $state(false);
  let error = $state('');
  let expired = $state(false);
  let secondsLeft = $state(0);

  const qrSvg = $derived.by(() => {
    if (!link) return '';
    // Correction 'M': assez robuste pour un ecran, sans grossir le motif
    const qr = qrcode(0, 'M');
    qr.addData(link.url);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  });

  async function start() {
    busy = true;
    error = '';
    expired = false;
    try {
      link = await api.post<TelegramLink>('/api/me/channels/telegram/link');
      poll();
      tick();
    } catch (err) {
      error =
        err instanceof ApiError
          ? err.message
          : 'Impossible de joindre le service, reessaie dans un instant.';
    } finally {
      busy = false;
    }
  }

  /** Interroge le serveur jusqu'a ce que le message arrive, ou expiration. */
  function poll() {
    const timer = setInterval(async () => {
      if (!link || expired) return clearInterval(timer);
      try {
        const status = await api.get<TelegramLinkStatus>('/api/me/channels/telegram/link');
        if (status.status === 'linked' && status.channel) {
          clearInterval(timer);
          link = null;
          onlinked(status.channel);
        }
      } catch {
        /* panne passagere: le prochain tour reessaiera */
      }
    }, 2500);
  }

  /** Compte a rebours: un code silencieusement perime laisserait l'utilisateur
   *  attendre devant un lien qui ne marche plus. */
  function tick() {
    const timer = setInterval(() => {
      if (!link) return clearInterval(timer);
      secondsLeft = Math.max(0, Math.round((Date.parse(link.expires_at) - Date.now()) / 1000));
      if (secondsLeft === 0) {
        expired = true;
        link = null;
        clearInterval(timer);
      }
    }, 1000);
  }

  const countdown = $derived(
    `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
  );
</script>

{#if !link}
  <button class="btn" onclick={start} disabled={busy}>
    {busy ? 'Un instant…' : 'Connecter Telegram'}
  </button>

  {#if expired}
    <p class="alert alert-warn small">Le lien a expire. Relance la connexion.</p>
  {/if}
  {#if error}
    <p class="alert alert-error small">{error}</p>
  {/if}
{:else}
  <div class="linking">
    <ol>
      <li>
        <a class="btn btn-brand" href={link.url} target="_blank" rel="noopener">
          Ouvrir @{link.bot_username}
        </a>
        <span class="small muted">— ou scanne le code depuis ton telephone</span>
      </li>
      <li>Appuie sur <strong>Demarrer</strong> dans Telegram.</li>
      <li>C'est tout : cette page se met a jour toute seule.</li>
    </ol>

    <div class="qr">
      {@html qrSvg}
    </div>

    <p class="small muted fallback">
      Si le lien ne s'ouvre pas, ecris ce code au bot <strong>@{link.bot_username}</strong> :
      <code>{link.code}</code>
    </p>

    <p class="small muted status">
      <span class="dot" aria-hidden="true"></span>
      En attente de ton message… (expire dans {countdown})
    </p>
  </div>
{/if}

<style>
  .linking {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.1rem;
    background: var(--bg);
  }

  ol { margin: 0 0 1rem; padding-left: 1.3rem; }
  li { margin-bottom: 0.6rem; }
  li:last-child { margin-bottom: 0; }

  .qr {
    width: 190px;
    max-width: 100%;
    margin: 0 auto 0.9rem;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.4rem;
  }
  .qr :global(svg) { display: block; width: 100%; height: auto; }

  .fallback { margin: 0 0 0.7rem; }

  code {
    background: #f0ede4;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .status { display: flex; align-items: center; gap: 0.45rem; margin: 0; }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--leaf);
    flex-shrink: 0;
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot { animation: none; opacity: 1; }
  }

  .alert { margin: 0.8rem 0 0; }
</style>
