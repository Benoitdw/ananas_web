<script lang="ts">
  import AuthForm from '$lib/components/AuthForm.svelte';
  import { register } from '$lib/stores/auth';
</script>

<svelte:head><title>Creer un compte — Ananas</title></svelte:head>

<AuthForm mode="register" submit={register} />
