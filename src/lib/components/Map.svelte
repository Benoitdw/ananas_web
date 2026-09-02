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

  function toGeoJSON(list: Company[]) {
    return {
      type: 'FeatureCollection' as const,
      features: list
        .filter((c) => c.lat !== null && c.lon !== null)
        .map((c) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [c.lon as number, c.lat as number] },
          properties: {
            id: c.id,
            name: c.name,
            city: c.city,
            saved: c.is_saved,
            selected: c.id === selectedId
          }
        }))
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
