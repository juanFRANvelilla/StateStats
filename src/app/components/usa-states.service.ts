import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { CovidData, StateInterface } from '../components/model/state-interface';
import { ViewMode } from './model/view-mode';
import { Feature } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import { LayerSelected } from './model/layer-selected';


@Injectable({
  providedIn: 'root'
})
export class UsaStatesService {
  private stateList = new BehaviorSubject<StateInterface[]>([]);
  private viewMode = new BehaviorSubject<ViewMode>(ViewMode.LIST_STATES);
  private selectedPolygon = new BehaviorSubject<Feature | null>(null);
  private mapLayers = new BehaviorSubject<LayerSelected[]>([]);
  private cleanAllSubject = new BehaviorSubject<void | null>(null);

  constructor(private http: HttpClient) { }

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
  }

  getStates(): Observable<any> {
    return this.http.get<any>('assets/us-states.geojson');
  }

  getPopulationByState(name: string): Observable<number | null> {
    return this.http.get<any[]>('assets/us-states-population.json').pipe(
      map((data) => {
        const stateData = data.find(state => state.name.toLowerCase() === name.toLowerCase());
        return stateData ? +stateData.population.replace(/,/g, '') : null;
      })
    );
  }

  getCovidData(state: string): Observable<CovidData> {
    return this.http.get<any>(`https://api.covidtracking.com/v1/states/${state.toLocaleLowerCase()}/current.json`);
  }

  getCleanAll(): Observable<void | null> {
    return this.cleanAllSubject.asObservable();
  }

  triggerCleanAll() {
    // Deseleccionar estados
    const updatedStateList = this.stateList.value.map(state => ({ ...state, selected: false }));
    this.setStateList(updatedStateList);

    // Limpiar poligono seleccionado
    this.setSelectedPolygon(null);

    // Notificar limpieza (para mapa)
    this.cleanAllSubject.next();
  }
}
