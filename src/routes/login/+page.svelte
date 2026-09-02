<script lang="ts">
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { login } from '$lib/stores/auth';
</script>

<svelte:head><title>Connexion — Ananas</title></svelte:head>

<AuthForm mode="login" submit={login} />
