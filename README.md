# Ananas — front

Interface SvelteKit du SaaS **Ananas** : carte des entreprises, enregistrement
des entreprises a suivre, reglage des notifications.

Depot independant de l'API (`../api`) : les deux ne se connaissent que par le
contrat HTTP.

## Demarrage

Le chemin normal est le `docker-compose.yml` du dossier parent, qui lance l'API
et la base en meme temps. Voir `../README.md`.

En autonome (API deja lancee sur le port 8000) :

```bash
npm install
echo "PUBLIC_API_URL=http://localhost:8000" > .env
npm run dev          # http://localhost:5173
```

## Pages

| route | role |
|---|---|
| `/` | hero banner |
| `/register`, `/login` | compte actif des la creation, aucun mail a valider |
| `/map` | carte + filtres + fiche entreprise + enregistrement |
| `/jobs` | offres ouvertes chez les entreprises suivies |
| `/settings` | chat_id Telegram et bouton d'envoi de test |

## Points d'architecture

**SPA, pas de SSR** (`src/routes/+layout.ts`). La session est un cookie
httpOnly pose par l'API sur une autre origine : le rendu serveur de SvelteKit
ne le porte pas, il n'aurait rien a rendre d'utile.

**Un seul client HTTP** (`src/lib/api.ts`), avec `credentials: 'include'` —
indispensable pour que le cookie de session traverse. Cote API, cela impose
`allow_credentials` et une liste d'origines explicite.

**Filtrage cote client.** Les 81 entreprises sont chargees une fois et filtrees
en memoire (`src/lib/stores/companies.ts`), ce qui rend la recherche instantanee
et evite une requete a chaque frappe. A revoir au-dela de quelques milliers de
lignes.

**Fond de carte OpenFreeMap** (style `positron`) : vecteur, gratuit, sans cle
d'API ni quota, visuellement identique au `carto-positron` du POC d'origine.
Le CDN de CARTO, lui, exige desormais une cle.

**Favoris optimistes.** `toggleSaved` met le store a jour avant l'aller-retour
reseau et revient en arriere si l'appel echoue : la carte reagit au clic.

**Deux mises en page, pas une grille qui retrecit.** Au-dessus de 900px, trois
colonnes cote a cote (liste | carte | fiche). En dessous, une seule vue occupe
l'ecran : la recherche et les filtres restent en haut (`display: contents`
dissout la sidebar pour que ses controles deviennent une rangee de la grille),
la carte et la liste se partagent la place via un commutateur flottant, et la
fiche s'ouvre en plein ecran. A 390px de large, trois panneaux cote a cote sont
illisibles tous les trois.

La carte reste montee quand elle est masquee : MapLibre ne detecte pas un
passage par `display:none`, d'ou le `resize()` expose par `Map.svelte`.

## Verifications

```bash
npm run check     # svelte-check: types et a11y
npm run build     # compile reellement tous les composants
```
