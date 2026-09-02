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
| `/companies/new` | proposer une entreprise absente du repertoire |
| `/settings` | profil (CV + aspirations), seuil de pertinence, connexion Telegram |

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

**L'import PDF remplit le champ, il ne lance pas l'analyse.** Une extraction
PDF melange parfois les colonnes : l'utilisateur doit pouvoir relire et
corriger avant, sinon un profil faux produit des scores faux sans que rien ne
le signale.

**Le profil montre ce qui a ete compris** (`ProfileForm.svelte`). Apres
analyse du CV, l'interface affiche la forme structuree qui en a ete extraite —
metiers vises, competences, ce qu'on veut eviter. C'est la seule facon pour
l'utilisateur de constater qu'une ligne a ete mal lue et de corriger son texte,
plutot que de subir des scores inexplicables.

**Connexion Telegram sans secret** (`TelegramLink.svelte`). Le composant
n'affiche jamais le token — il demande un code au serveur, en fait un lien
profond et un QR (`qrcode-generator`, sans dependance), puis interroge le
serveur toutes les 2,5 s jusqu'a ce que l'utilisateur ait appuye sur
« Demarrer ». Le compte a rebours evite de laisser quelqu'un attendre devant un
lien perime.

**Saisie de tags guidee** (`TagInput.svelte`). Les tags servent aux *autres*
utilisateurs a filtrer: leur valeur depend de leur reutilisation. Le champ met
donc en avant les tags deja presents, et une suggestion cliquee est ajoutee
telle quelle — la normaliser en creerait une variante. Le serveur reste
l'autorite et rattache les saisies libres au vocabulaire existant.

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
