import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { StateInterface } from '../components/model/state-interface';
import { ViewMode } from './model/view-mode';
import { Feature } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import { LayerSelected } from './model/layer-selected';
import { AppPersistenceService } from '../services/app-persistence.service';


@Injectable({
  providedIn: 'root'
})
export class UsaStatesService {
  private stateList = new BehaviorSubject<StateInterface[]>([]);
  private viewMode = new BehaviorSubject<ViewMode>(ViewMode.LIST_STATES);
  private selectedPolygon = new BehaviorSubject<Feature | null>(null);
  private mapLayers = new BehaviorSubject<LayerSelected[]>([]);
  private cleanAllSubject = new BehaviorSubject<void | null>(null);

  constructor(
    private http: HttpClient,
    private persistence: AppPersistenceService
  ) {
    const savedView = this.persistence.getViewMode();
    if (savedView) {
      this.viewMode.next(savedView);
    }
  }

  getSelectedPolygon(): Observable<Feature | null> {
    return this.selectedPolygon.asObservable();
  }

  setSelectedPolygon(polygon: Feature | null) {
    this.selectedPolygon.next(polygon);
  }

  getViewMode(): Observable<ViewMode> {
    return this.viewMode.asObservable();
  }

  setViewMode(viewMode: ViewMode) {
    this.viewMode.next(viewMode);
    this.persistence.setViewMode(viewMode);
  }

  addLayerSelected(newLayerSelected: LayerSelected): void {
    this.mapLayers.next([...this.mapLayers.value, newLayerSelected]);
  }

  manageMapLayer(selected: boolean, newLayer: VectorLayer): void {
    const layer = this.mapLayers.value.find(layer => layer.layer.get('name') === newLayer.get('name'));
    //si la capa ya existe, se actualiza el estado de la capa
    if (layer) {
      layer.selected = selected;
      this.mapLayers.next([...this.mapLayers.value]);
    } else {
      // si es una nueva capa se agreaga a la lista
      const newLayerSelected: LayerSelected = { layer: newLayer, selected: selected };
      this.addLayerSelected(newLayerSelected);
    }
  }

  getMapLayers(): Observable<LayerSelected[]> {
    return this.mapLayers.asObservable();
  }

  getStateList(): Observable<StateInterface[]> {
    return this.stateList.asObservable();
  }

  setStateList(newStateList: StateInterface[]): void {
    this.stateList.next(newStateList);
  }

  selectState(stateChanged: StateInterface, active: boolean): void {
    stateChanged.selected = active;
    const updatedStateList = this.stateList.value.map(state => {
      if (state.code === stateChanged.code) {
        return { ...state, selected: active };
      }
      return state;
    });

    const selectedState: StateInterface[] = updatedStateList.filter(state => state.selected === true && state.code !== stateChanged.code);
    const unselectedStates: StateInterface[] = updatedStateList.filter(state => state.selected === false);

    const newStateList = active ? [stateChanged, ...selectedState, ...unselectedStates] : [...selectedState, ...unselectedStates];
    this.setStateList(newStateList);
    this.persistSelectedCodes();
  }

  private persistSelectedCodes(): void {
    const codes = this.stateList.value.filter((s) => s.selected).map((s) => s.code);
    this.persistence.setSelectedStateCodes(codes);
  }

  /** Restaura selección desde localStorage tras cargar el listado de estados (censo). */
  applyPersistedSelection(): void {
    const codes = new Set(this.persistence.getSelectedStateCodes());
    if (codes.size === 0 || this.stateList.value.length === 0) {
      return;
    }
    const list = this.stateList.value.map((s) => ({ ...s, selected: codes.has(s.code) }));
    const selected = list.filter((s) => s.selected);
    const unselected = list.filter((s) => !s.selected);
    this.setStateList([...selected, ...unselected]);
    this.persistSelectedCodes();
  }

  getStates(): Observable<any> {
    return this.http.get<any>('assets/us-states.geojson');
  }

  getCensusData(): Observable<any[]> {
    const url = 'https://api.census.gov/data/2023/acs/acs5?get=NAME,B01003_001E,B19013_001E,B17001_002E,B23025_005E,B23025_004E,B25077_001E,B25064_001E,B15003_022E,B27001_001E&for=state:*';
    return this.http.get<any[]>(url);
  }

  getCleanAll(): Observable<void | null> {
    return this.cleanAllSubject.asObservable();
  }

  triggerCleanAll() {
    const updatedStateList = this.stateList.value.map(state => ({ ...state, selected: false }));
    this.setStateList(updatedStateList);
    this.persistence.clearSessionState();
    this.setSelectedPolygon(null);
    this.cleanAllSubject.next();
  }
}
