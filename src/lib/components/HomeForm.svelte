<script lang="ts">
  /**
   * Adresse de reference et rayon de recherche.
   *
   * L'adresse est geocodee par le serveur a l'enregistrement (~1 s): le
   * formulaire attend, puis affiche ce qui a ete trouve — position exacte,
   * commune seule, ou rien. Sans ce retour, quelqu'un dont l'adresse n'a pas
   * ete reconnue verrait simplement une carte sans cercle, sans savoir
   * pourquoi.
   *
   * Le rayon est enregistre avec l'adresse plutot que separement: c'est un
   * seul reglage — « ce que je considere comme proche de chez moi » — et le
   * dissocier obligerait a deux allers-retours pour le meme geste.
   */
  import { untrack } from 'svelte';
  import { ApiError } from '$lib/api';
  import { clearHome, formatKm, saveHome } from '$lib/stores/home';
  import type { Home } from '$lib/types';

  type Props = { home: Home };
  let { home }: Props = $props();

  // Copie initiale volontaire (d'ou `untrack`): le formulaire est un
  // brouillon. Le relier au store le ferait se reecrire sous les doigts a
  // chaque rafraichissement — y compris celui que declenche l'enregistrement.
  let form = $state(
    untrack(() => ({
      street: home.street,
      postal_code: home.postal_code,
      city: home.city,
      country: home.country || 'Belgium',
      radius_km: home.radius_km,
      notify_within_radius: home.notify_within_radius
    }))
  );

  let busy = $state(false);
  let feedback = $state<{ kind: 'ok' | 'error' | 'warn'; text: string } | null>(null);

  const isSet = $derived(!!(home.street || home.city || home.postal_code));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    feedback = null;
    try {
      const saved = await saveHome({ ...form, radius_km: Number(form.radius_km) });
      feedback =
        saved.lat === null
          ? {
              kind: 'warn',
              text: "Adresse enregistree, mais introuvable sur la carte. Essaie avec la commune seule, ou verifie l'orthographe."
            }
          : { kind: 'ok', text: describe(saved) };
    } catch (err) {
      feedback = {
        kind: 'error',
        text: err instanceof ApiError ? err.message : 'Enregistrement impossible.'
      };
    } finally {
      busy = false;
    }
  }

  /** Dire honnetement ou le point a ete place — meme vocabulaire que les
   *  fiches d'entreprise. */
  function describe(saved: Home): string {
    return saved.geo_precision === 'adresse'
      ? 'Adresse localisee precisement.'
      : 'Adresse enregistree. Seule la commune a pu etre localisee: les distances sont approximatives.';
  }

  async function forget() {
    busy = true;
    feedback = null;
    try {
      await clearHome();
      form = {
        street: '',
        postal_code: '',
        city: '',
        country: 'Belgium',
        radius_km: 25,
        notify_within_radius: false
      };
      feedback = { kind: 'ok', text: 'Domicile supprime.' };
    } catch {
      feedback = { kind: 'error', text: 'Suppression impossible.' };
    } finally {
      busy = false;
    }
  }
</script>

<form onsubmit={submit}>
  <div class="field">
    <label for="home-street">Rue et numero</label>
    <input id="home-street" type="text" bind:value={form.street} autocomplete="street-address" />
  </div>

  <div class="row">
    <div class="field cp">
      <label for="home-cp">Code postal</label>
      <input id="home-cp" type="text" bind:value={form.postal_code} autocomplete="postal-code" />
    </div>
    <div class="field">
      <label for="home-city">Ville</label>
      <input id="home-city" type="text" bind:value={form.city} autocomplete="address-level2" />
    </div>
    <div class="field">
      <label for="home-country">Pays</label>
      <input id="home-country" type="text" bind:value={form.country} autocomplete="country-name" />
    </div>
  </div>

  <div class="field">
    <label for="home-radius">
      Perimetre de recherche : <strong>{form.radius_km} km</strong>
    </label>
    <input id="home-radius" type="range" min="1" max="150" step="1" bind:value={form.radius_km} />
    <p class="small muted hint">
      Le rayon par defaut du filtre et du cercle trace sur la carte. Tu peux toujours le faire
      varier depuis la carte sans toucher a ce reglage.
    </p>
  </div>

  <label class="check">
    <input type="checkbox" bind:checked={form.notify_within_radius} />
    Ne me notifier que les offres dans ce perimetre
  </label>
  <p class="small muted hint stacked">
    La distance est mesuree au siege de l'entreprise. Une entreprise dont la position est inconnue
    reste notifiee, et la notification annonce en pied de message combien d'offres le rayon a
    ecartees — la page Offres, elle, continue de tout montrer.
  </p>

  {#if home.lat !== null}
    <p class="small muted located">
      Point de reference : <strong>{home.address}</strong>
      {#if home.geo_precision && home.geo_precision !== 'adresse'}
        <span class="approx">(position approximative : {home.geo_precision})</span>
      {/if}
    </p>
  {/if}

  <div class="actions">
    <button class="btn btn-brand" type="submit" disabled={busy}>
      {busy ? 'Localisation…' : 'Enregistrer'}
    </button>
    {#if isSet}
      <button class="btn btn-ghost danger" type="button" onclick={forget} disabled={busy}>
        Oublier mon adresse
      </button>
    {/if}
  </div>

  {#if feedback}
    <p class="alert alert-{feedback.kind === 'ok' ? 'ok' : feedback.kind === 'warn' ? 'warn' : 'error'} small">
      {feedback.text}
    </p>
  {/if}

  {#if home.lat !== null}
    <p class="small muted hint">
      Sur la carte, ton domicile est le point sombre et le cercle en pointilles couvre
      {formatKm(home.radius_km)}.
    </p>
  {/if}
</form>

<style>
  .row {
    display: grid;
    grid-template-columns: 7rem minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.7rem;
  }
  /* A cette largeur, trois champs cote a cote font moins de 6rem chacun */
  @media (max-width: 560px) {
    .row { grid-template-columns: 7rem minmax(0, 1fr); }
  }

  .field { margin-bottom: 0.9rem; }
  .hint { margin: 0.3rem 0 0; }

  input[type='range'] { width: 100%; accent-color: var(--leaf); }

  .check {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 500;
    margin-bottom: 0.3rem;
  }
  .check input { width: auto; flex-shrink: 0; }
  .stacked { margin: 0 0 1.1rem; }

  .located { margin: 0 0 0.9rem; }
  .approx { color: var(--muted); }

  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .danger { color: var(--danger); }

  .alert { margin: 1rem 0 0; }
</style>
