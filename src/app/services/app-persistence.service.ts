import { Injectable } from '@angular/core';
import { ViewMode } from '../components/model/view-mode';

const PREFIX = 'demo-open-layers';

const KEYS = {
  selectedStateCodes: `${PREFIX}.selectedStateCodes`,
  polygonsGeoJSON: `${PREFIX}.polygonsGeoJSON`,
  viewMode: `${PREFIX}.viewMode`,
  mapView: `${PREFIX}.mapView`,
} as const;

/** Vista del mapa: centro y extent en EPSG:3857 + zoom. */
export interface PersistedMapView {
  center: [number, number];
  extent: [number, number, number, number];
  zoom: number;
}

@Injectable({
  providedIn: 'root',
})
export class AppPersistenceService {
  getSelectedStateCodes(): string[] {
    try {
      const raw = localStorage.getItem(KEYS.selectedStateCodes);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
    } catch {
      return [];
    }
  }

  setSelectedStateCodes(codes: string[]): void {
    try {
      localStorage.setItem(KEYS.selectedStateCodes, JSON.stringify(codes));
    } catch {
      /* ignore quota */
    }
  }

  getPolygonsGeoJSON(): string | null {
    return localStorage.getItem(KEYS.polygonsGeoJSON);
  }

  setPolygonsGeoJSON(geojsonString: string): void {
    try {
      if (!geojsonString || geojsonString === '{"type":"FeatureCollection","features":[]}') {
        localStorage.removeItem(KEYS.polygonsGeoJSON);
      } else {
        localStorage.setItem(KEYS.polygonsGeoJSON, geojsonString);
      }
    } catch {
      /* ignore */
    }
  }

  getViewMode(): ViewMode | null {
    try {
      const raw = localStorage.getItem(KEYS.viewMode);
      if (!raw) return null;
      if (Object.values(ViewMode).includes(raw as ViewMode)) {
        return raw as ViewMode;
      }
      return null;
    } catch {
      return null;
    }
  }

  setViewMode(mode: ViewMode): void {
    try {
      localStorage.setItem(KEYS.viewMode, mode);
    } catch {
      /* ignore */
    }
  }

  getMapView(): PersistedMapView | null {
    try {
      const raw = localStorage.getItem(KEYS.mapView);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<PersistedMapView>;
      if (!parsed || typeof parsed.zoom !== 'number' || !Number.isFinite(parsed.zoom)) {
        return null;
      }
      let center = parsed.center;
      let extent = parsed.extent;
      if (!Array.isArray(extent) || extent.length !== 4) {
        return null;
      }
      const [ex1, ex2, ex3, ex4] = extent;
      if (![ex1, ex2, ex3, ex4].every((n) => typeof n === 'number' && Number.isFinite(n))) {
        return null;
      }
      const ext = extent as [number, number, number, number];
      if (!Array.isArray(center) || center.length !== 2) {
        const cx = (ext[0] + ext[2]) / 2;
        const cy = (ext[1] + ext[3]) / 2;
        center = [cx, cy];
      } else {
        const [cx, cy] = center;
        if (typeof cx !== 'number' || typeof cy !== 'number' || !Number.isFinite(cx) || !Number.isFinite(cy)) {
          return null;
        }
        center = [cx, cy];
      }
      return { center: center as [number, number], extent: ext, zoom: parsed.zoom };
    } catch {
      return null;
    }
  }

  setMapView(view: PersistedMapView): void {
    try {
      localStorage.setItem(KEYS.mapView, JSON.stringify(view));
    } catch {
      /* ignore */
    }
  }

  /** Limpia selección de estados y polígonos (p. ej. “Limpiar todo”). */
  clearSessionState(): void {
    try {
      localStorage.removeItem(KEYS.selectedStateCodes);
      localStorage.removeItem(KEYS.polygonsGeoJSON);
    } catch {
      /* ignore */
    }
  }
}
