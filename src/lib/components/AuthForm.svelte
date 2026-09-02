<script lang="ts">
  import { goto } from '$app/navigation';
  import { ApiError } from '$lib/api';

  type Props = {
    mode: 'login' | 'register';
    submit: (email: string, password: string) => Promise<unknown>;
  };
  let { mode, submit }: Props = $props();

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  const isRegister = $derived(mode === 'register');

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    busy = true;
    try {
      await submit(email.trim(), password);
      goto('/map');
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : 'Service indisponible, reessaie dans un instant.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="wrap">
  <form class="card" onsubmit={onSubmit}>
    <h1>{isRegister ? 'Creer un compte' : 'Connexion'}</h1>
    <p class="muted small intro">
      {isRegister
        ? 'Un email, un mot de passe. Le compte est actif immediatement, aucune verification a attendre.'
        : 'Content de te revoir.'}
    </p>

    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}

    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} required autocomplete="email" />
    </div>

    <div class="field">
      <label for="password">Mot de passe</label>
      <input
        id="password"
        type="password"
        bind:value={password}
        required
        minlength={isRegister ? 8 : undefined}
        autocomplete={isRegister ? 'new-password' : 'current-password'}
      />
      {#if isRegister}
        <p class="small muted hint">8 caracteres minimum.</p>
      {/if}
    </div>

    <button class="btn" type="submit" disabled={busy}>
      {busy ? 'Un instant…' : isRegister ? 'Creer mon compte' : 'Se connecter'}
    </button>

    <p class="small muted switch">
      {#if isRegister}
        Deja un compte ? <a href="/login">Se connecter</a>
      {:else}
        Pas encore de compte ? <a href="/register">En creer un</a>
      {/if}
    </p>
  </form>
</div>

<style>
  .wrap { display: flex; justify-content: center; padding: 3.5rem 1.25rem; }

  form { width: 100%; max-width: 380px; padding: 1.8rem; }

  h1 { font-size: 1.4rem; }

  .intro { margin: 0 0 1.4rem; }

  .field { margin-bottom: 1rem; }

  .hint { margin: 0.3rem 0 0; }

  .alert { margin-bottom: 1rem; }

  .btn { width: 100%; }

  .switch { text-align: center; margin: 1.1rem 0 0; }
</style>
