<script lang="ts">
  /**
   * Carte MapLibre.
   *
   * Fond de carte: OpenFreeMap "positron" — vecteur, gratuit, sans cle d'API
   * ni quota, et visuellement identique au carto-positron du POC Dash.
   * (Le CDN de CARTO, lui, exige desormais une cle.)
   *
   * Les entreprises sont une source GeoJSON unique avec deux couches, pour que
   * les favoris passent devant et en orange sans dupliquer les donnees.
   */
  import { onMount } from 'svelte';
  import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { Company } from '$lib/types';

  type Props = {
    companies: Company[];
    selectedId: number | null;
    onselect: (id: number) => void;
  };
  let { companies, selectedId, onselect }: Props = $props();

  let container: HTMLDivElement;
  let map: MapLibreMap | null = $state(null);
  let ready = $state(false);

  const SOURCE = 'companies';
  // Cadrage du POC: la Belgique entiere
  const CENTER: [number, number] = [4.66, 50.64];
  const ZOOM = 7.2;

  const STYLE = 'https://tiles.openfreemap.org/styles/positron';

  // Une entreprise geocodee a la ville tombe exactement sur le point de sa
  // commune: dix se superposent a Leuven, huit a Bruxelles, sept a Gosselies,
  // et un seul marqueur serait cliquable. On les eclate autour de ce point a
  // l'affichage uniquement — les coordonnees stockees ne bougent pas, et
  // `geo_precision` continue de dire "ville" dans la fiche.
  const SPREAD_M = 450;
  const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
  const M_PER_DEG = 111_320;

  /** Decale un point sur un cercle de SPREAD_M, a un angle deduit de l'id.
   *  L'angle d'or separe au mieux des ids consecutifs — ceux d'une meme ville,
   *  importes a la suite — et l'offset ne depend que de l'entreprise: filtrer
   *  la carte ne fait pas sauter les marqueurs restants. */
  function fanOut(lon: number, lat: number, id: number): [number, number] {
    const angle = id * GOLDEN_ANGLE;
    return [
      lon + (SPREAD_M * Math.sin(angle)) / (M_PER_DEG * Math.cos((lat * Math.PI) / 180)),
      lat + (SPREAD_M * Math.cos(angle)) / M_PER_DEG
    ];
  }

  function toGeoJSON(list: Company[]) {
    const located = list.filter((c) => c.lat !== null && c.lon !== null);

    const occupants = new Map<string, number>();
    for (const c of located) {
      const key = `${c.lat},${c.lon}`;
      occupants.set(key, (occupants.get(key) ?? 0) + 1);
    }

    return {
      type: 'FeatureCollection' as const,
      features: located.map((c) => {
        const lon = c.lon as number;
        const lat = c.lat as number;
        const shared = (occupants.get(`${c.lat},${c.lon}`) ?? 0) > 1;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: shared ? fanOut(lon, lat, c.id) : [lon, lat]
          },
          properties: {
            id: c.id,
            name: c.name,
            city: c.city,
            saved: c.is_saved,
            selected: c.id === selectedId
          }
        };
      })
    };
  }

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style: STYLE,
      center: CENTER,
      zoom: ZOOM,
      attributionControl: { compact: true }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      if (!map) return;

      map.addSource(SOURCE, { type: 'geojson', data: toGeoJSON(companies) });

      // Couche du bas: les entreprises non enregistrees, en teal
      map.addLayer({
        id: 'company-dots',
        type: 'circle',
        source: SOURCE,
        filter: ['!', ['get', 'saved']],
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 10, 6.5],
          'circle-color': '#2a9d8f',
          'circle-stroke-width': ['case', ['get', 'selected'], 3, 1.5],
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9
        }
      });

      // Couche du dessus: les favoris, plus gros et en orange — c'est ce qui
      // permet de repérer sa liste de veille d'un coup d'oeil.
      map.addLayer({
        id: 'company-saved',
        type: 'circle',
        source: SOURCE,
        filter: ['get', 'saved'],
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 13, 9.5],
          'circle-color': '#e76f51',
          'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
          'circle-stroke-color': '#ffffff'
        }
      });

      for (const layer of ['company-dots', 'company-saved']) {
        map.on('click', layer, (event) => {
          const feature = event.features?.[0];
          if (feature) onselect(feature.properties.id as number);
        });
        map.on('mouseenter', layer, () => (map!.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map!.getCanvas().style.cursor = ''));
      }

      ready = true;
    });

    return () => map?.remove();
  });

  // Rejoue la source a chaque changement de filtre ou de favori.
  $effect(() => {
    if (!ready || !map) return;
    const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(toGeoJSON(companies));
  });

  /** A appeler quand le conteneur change de taille (bascule carte/liste sur
   *  mobile): MapLibre ne detecte pas un passage par display:none. */
  export function resize() {
    map?.resize();
  }

  /** Centre la carte sur une entreprise, sans dezoomer si on est deja proche. */
  export function focus(company: Company) {
    if (!map || company.lat === null || company.lon === null) return;
    map.easeTo({
      center: [company.lon, company.lat],
      zoom: Math.max(map.getZoom(), 11),
      duration: 600
    });
  }
</script>

<div class="map" bind:this={container}></div>

<style>
  .map { width: 100%; height: 100%; }

  /* Le style par defaut de MapLibre est tres sombre sur fond clair */
  :global(.maplibregl-ctrl-attrib) { font-size: 10px; }
</style>
