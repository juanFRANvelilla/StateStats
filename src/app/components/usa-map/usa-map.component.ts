import { HttpClientModule } from '@angular/common/http';
import { Component, ElementRef, HostListener, ViewChild, effect } from '@angular/core';
import { View, Map as OlMap, Feature } from 'ol';
import { OSM } from 'ol/source';
import XYZ from 'ol/source/XYZ';
import { Vector as VectorLayer } from 'ol/layer';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import { Geometry, LineString, Polygon } from 'ol/geom';
import Draw from 'ol/interaction/Draw';
import { UsaStatesService } from '../usa-states.service';
import { StateInterface } from '../model/state-interface';
import { FormsModule } from '@angular/forms';
import { defaults as defaultControls } from 'ol/control';
import { CommonModule } from '@angular/common';
import { fromLonLat, toLonLat } from 'ol/proj';
import { StateComparedComponent } from '../states-list/state-compared/state-compared.component';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogComponent } from '../states-list/error-dialog/error-dialog.component';
import { Modify, Translate } from 'ol/interaction';
import { LanguageService } from '../../services/language.service';
import { Select } from 'ol/interaction';
import { click } from 'ol/events/condition';
import * as turf from '@turf/turf';
// @ts-ignore
import Transform from 'ol-ext/interaction/Transform';
import booleanIntersects from '@turf/boolean-intersects';
import * as turfHelpers from "@turf/helpers";
import turfDifference from '@turf/difference';
import pointInPolygon from "@turf/boolean-point-in-polygon";
import Point from 'ol/geom/Point';
import {
  DragAndDrop,
} from 'ol/interaction.js';
import { GeoJSON, TopoJSON } from 'ol/format.js';
import {
  Tile as TileLayer,
} from 'ol/layer.js';
import { Vector as VectorSource } from 'ol/source.js';
import { ViewMode } from '../model/view-mode';
import { LayerSelected } from '../model/layer-selected';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../services/theme.service';
import { AppPersistenceService } from '../../services/app-persistence.service';

@Component({
  selector: 'app-usa-map',
  standalone: true,
  imports: [
    HttpClientModule,
    FormsModule,
    CommonModule,
    StateComparedComponent,
    MatTooltipModule,
  ],
  templateUrl: './usa-map.component.html',
  styleUrl: './usa-map.component.scss',
})
export class UsaMapComponent {
  @ViewChild('langSelect', { read: ElementRef })
  private langSelectRef?: ElementRef<HTMLSelectElement>;

  private vectorSource!: VectorSource;
  private polygonVectorSource!: VectorSource;

  private polygonVectorLayer!: VectorLayer;
  private map!: OlMap;
  tooltipElement!: HTMLElement;
  private stateList: StateInterface[] = [];
  filteredStateList: StateInterface[] = [];
  searchTerm: string = '';
  literals: any = {};
  currentLang: string = 'es';

  disabledActions = false;
  statesFeatures: Feature[] = [];
  selectedPolygon: Feature | null = null;

  private select: Select | null = null;

  drawPolygon: Draw | null = null;
  drawPolygonCut: Draw | null = null;
  drawPolygonUnion: Draw | null = null;
  drawPolygonContainCut: Draw | null = null;
  drawLine: Draw | null = null;
  modifyInteraction: Modify | null = null;
  translateInteraction: Translate | null = null;

  comparedStates: boolean = false;
  statesToCompare: StateInterface[] = [];

  polygonActionMenuPosition: { leftPx: number; topPx: number } | null = null;
  currentViewMode: ViewMode = ViewMode.LIST_STATES;

  private initialCenter: [number, number] | null = null;
  private initialZoom: number | null = null;
  private mapViewSaveTimer: ReturnType<typeof setTimeout> | undefined;

  dragAndDropInteraction: DragAndDrop | null = null;;
  link!: HTMLAnchorElement;

  viewMode = ViewMode;

  constructor(
    private usaStatesService: UsaStatesService,
    public dialog: MatDialog,
    public languageService: LanguageService,
    public themeService: ThemeService,
    private appPersistence: AppPersistenceService
  ) {
    effect(() => {
      this.themeService.isDark();
      this.syncBaseLayerFromTheme();
    });
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent) {
    const selectEl = this.langSelectRef?.nativeElement;
    if (!selectEl) return;

    const target = event.target as Node | null;
    const isClickInsideSelect = !!target && selectEl.contains(target);
    if (!isClickInsideSelect && document.activeElement === selectEl) {
      selectEl.blur();
    }
  }

  changeLanguage(lang: string) {
    this.languageService.changeLanguage(lang);
  }

  ngOnInit(): void {
    this.currentLang = this.languageService.currentLang;
    this.languageService.literals$.subscribe((literals) => {
      this.literals = literals;
    });

    this.initializeMap();
    this.tooltipElement = document.getElementById('tooltip')!;

    this.usaStatesService.getStates().subscribe((geojsonData: any) => {
      this.loadGeoJsonData(geojsonData);

      this.usaStatesService
        .getStateList()
        .subscribe((stateList: StateInterface[]) => {
          this.stateList = stateList;
          this.vectorSource.changed();
        });

      this.usaStatesService.getCensusData().subscribe((censusData: any[]) => {
        const dataRows = censusData.slice(1);

        geojsonData.features.forEach((feature: any) => {
          const stateCode = feature.properties.ste_stusps_code;
          const stateFips = feature.properties.ste_code[0];
          const stateName = feature.properties.ste_name[0];

          const stateRow = dataRows.find(row => row[10] === stateFips || row[0] === stateName);

          if (stateRow) {
            const mappedState: StateInterface = {
              name: stateName,
              code: stateFips,
              stateCode: stateCode,
              selected: false,
              totalPopulation: Number(stateRow[1] || 0),
              medianIncome: Number(stateRow[2] || 0),
              peopleInPoverty: Number(stateRow[3] || 0),
              unemployed: Number(stateRow[4] || 0),
              employed: Number(stateRow[5] || 0),
              medianHomeValue: Number(stateRow[6] || 0),
              medianRent: Number(stateRow[7] || 0),
              universityDegree: Number(stateRow[8] || 0),
              noHealthInsurance: Number(stateRow[9] || 0),
            };
            this.stateList.push(mappedState);
          }
        });
        this.usaStatesService.setStateList(this.stateList);
        this.usaStatesService.applyPersistedSelection();
      });
    });

    this.usaStatesService.getMapLayers().subscribe((mapLayers: LayerSelected[]) => {
      mapLayers.forEach((layerSelected) => {
        layerSelected.layer.setVisible(layerSelected.selected);
      });
    });

    this.usaStatesService.getViewMode().subscribe((viewMode) => {
      this.currentViewMode = viewMode;
    });

    this.usaStatesService.getCleanAll().subscribe(() => {
      if (this.polygonVectorSource) {
        this.polygonVectorSource.clear();
        this.persistPolygons();
      }
      this.selectedPolygon = null;
      if (this.initialCenter && this.initialZoom !== null) {
        this.map.getView().setCenter(fromLonLat(this.initialCenter));
        this.map.getView().setZoom(this.initialZoom);
      }
    });
  }

  private setSelectedFeature(feature: Feature) {
    // Quitar estilo propio del Draw para que aplique el estilo de capa (azul / selección).
    feature.setStyle(undefined);
    this.selectedPolygon = feature;
    this.usaStatesService.setSelectedPolygon(feature);
    this.polygonVectorLayer?.changed();
    this.updatePolygonActionMenuPosition();
  }

  private updatePolygonActionMenuPosition(): void {
    if (!this.map || !this.selectedPolygon) {
      this.polygonActionMenuPosition = null;
      return;
    }
    const geom = this.selectedPolygon.getGeometry();
    if (!(geom instanceof Polygon)) {
      this.polygonActionMenuPosition = null;
      return;
    }

    // Anclar el menú cerca del polígono, usando su punto interior (estable incluso con polígonos cóncavos).
    const interior = geom.getInteriorPoint();
    const coord =
      interior instanceof Point ? interior.getCoordinates() : geom.getFirstCoordinate();
    const pixel = this.map.getPixelFromCoordinate(coord);
    this.polygonActionMenuPosition = {
      leftPx: Math.round(pixel[0]),
      topPx: Math.round(pixel[1]),
    };
  }

  private loadGeoJsonData(geojsonObject: any): void {
    this.vectorSource = new VectorSource({
      features: new GeoJSON().readFeatures(geojsonObject, {
        featureProjection: 'EPSG:3857',
      }),
    });

    this.statesFeatures = this.vectorSource.getFeatures();

    const statesVectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: (feature) => this.getStyle(feature),
    });
    statesVectorLayer.set('name', 'StatesLayer');

    // vector source con las features que dibujemos nosotros
    this.polygonVectorSource = new VectorSource<Feature>({
      features: [],
    });

    this.polygonVectorLayer = new VectorLayer({
      source: this.polygonVectorSource,
      style: (feature) => this.getPolygonFeatureStyle(feature as Feature),
    });
    this.polygonVectorLayer.set('name', 'PolygonLayer');

    // dos layers, uno para los estados y otro para los poligonos
    this.map.addLayer(statesVectorLayer);
    this.usaStatesService.manageMapLayer(true, statesVectorLayer);
    this.map.addLayer(this.polygonVectorLayer);
    this.usaStatesService.manageMapLayer(true, this.polygonVectorLayer);

    this.restorePersistedPolygons();
    this.polygonVectorSource.on('addfeature', () => this.persistPolygons());
    this.polygonVectorSource.on('removefeature', () => this.persistPolygons());
    this.polygonVectorSource.on('changefeature', () => this.persistPolygons());
  }

  private persistPolygons(): void {
    if (!this.polygonVectorSource) {
      return;
    }
    const format = new GeoJSON();
    const geojson = format.writeFeaturesObject(this.polygonVectorSource.getFeatures(), {
      featureProjection: 'EPSG:3857',
    });
    this.appPersistence.setPolygonsGeoJSON(JSON.stringify(geojson));
  }

  private restorePersistedPolygons(): void {
    const raw = this.appPersistence.getPolygonsGeoJSON();
    if (!raw || !this.polygonVectorSource) {
      return;
    }
    try {
      const geojson = JSON.parse(raw);
      if (!geojson?.features?.length) {
        return;
      }
      const format = new GeoJSON();
      const features = format.readFeatures(geojson, {
        featureProjection: 'EPSG:3857',
      }) as Feature[];
      features.forEach((f) => f.setStyle(undefined));
      this.polygonVectorSource.addFeatures(features);
      this.polygonVectorLayer?.changed();
    } catch {
      this.appPersistence.setPolygonsGeoJSON('');
    }
  }

  filterStates(): void {
    if (this.searchTerm) {
      this.filteredStateList = this.stateList.filter((state) =>
        state.name.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    } else {
      this.filteredStateList = [];
    }
  }

  selectState(state: StateInterface, active: boolean): void {
    this.usaStatesService.selectState(state, active);
  }

  private initializeMap(): void {
    const osmLayer = new TileLayer({
      source: new OSM({
        attributions: [],
      }),
    });

    this.map = new OlMap({
      target: 'map',
      layers: [osmLayer],
      view: new View({
        center: fromLonLat([-98.5795, 39.8283]),
        zoom: 3,
      }),
      controls: defaultControls({
        zoom: false,
        attribution: false,
        rotate: false,
      }),
    });

    this.map.on('pointermove', (event) => this.handlePointerMove(event));
    this.map.on('singleclick', (event) => this.handleMapClick(event));
    this.map.on('moveend', () => {
      this.updatePolygonActionMenuPosition();
      this.schedulePersistMapView();
    });

    this.syncBaseLayerFromTheme();
    this.restoreMapView();
  }

  private schedulePersistMapView(): void {
    if (this.mapViewSaveTimer) {
      clearTimeout(this.mapViewSaveTimer);
    }
    this.mapViewSaveTimer = setTimeout(() => this.persistMapView(), 250);
  }

  private persistMapView(): void {
    if (!this.map) {
      return;
    }
    const view = this.map.getView();
    const size = this.map.getSize();
    const center = view.getCenter();
    const zoom = view.getZoom();
    if (!size || !center || zoom == null) {
      return;
    }
    const extent = view.calculateExtent(size);
    this.appPersistence.setMapView({
      center: [center[0], center[1]],
      extent: extent as [number, number, number, number],
      zoom,
    });
  }

  private restoreMapView(): void {
    const saved = this.appPersistence.getMapView();
    if (!saved || !this.map) {
      return;
    }
    const view = this.map.getView();
    view.setCenter(saved.center);
    view.setZoom(saved.zoom);
    this.map.updateSize();
  }

  /** Capa base OSM en modo claro, Carto Dark en modo oscuro (ThemeService). */
  private syncBaseLayerFromTheme(): void {
    if (!this.map) {
      return;
    }
    const layers = this.map.getLayers();
    const isDark = this.themeService.isDark();

    // Sustituir la capa Tile completa (no solo setSource) para vaciar caché de teselas
    // y evitar fondos blancos / mezcla al hacer zoom tras cambiar de tema.
    const newBase = new TileLayer({
      source: isDark
        ? new XYZ({
            url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            crossOrigin: 'anonymous',
            transition: 0,
          })
        : new OSM({
            attributions: [],
            transition: 0,
          }),
    });

    const first = layers.item(0);
    if (first instanceof TileLayer) {
      layers.removeAt(0);
    }
    layers.insertAt(0, newBase);
    newBase.changed();
    this.map.updateSize();
    this.map.renderSync();
  }

  private handlePointerMove(event: any) {
    if (!this.disabledActions) {
      const pixel = this.map.getEventPixel(event.originalEvent);
      // Solo capa de estados: la capa de polígonos está encima y ocultaría el estado bajo el cursor.
      const feature = this.map.forEachFeatureAtPixel(
        pixel,
        (feature) => feature,
        { layerFilter: (layer) => layer.get('name') === 'StatesLayer' }
      );

      if (feature && feature.getProperties()['ste_code']) {
        const properties = feature.getProperties();
        const stateName = properties['ste_name'][0];

        this.showTooltip(event.coordinate, stateName);
      } else {
        this.hideTooltip();
      }
    }
  }

  private handleMapClick(event: any) {
    if (!this.disabledActions) {
      const pixel = this.map.getEventPixel(event.originalEvent);

      const polygonFeature = this.map.forEachFeatureAtPixel(
        pixel,
        (feature) => feature,
        { layerFilter: (layer) => layer.get('name') === 'PolygonLayer' }
      ) as Feature<Geometry> | undefined;

      if (polygonFeature) {
        this.setSelectedFeature(polygonFeature);
        return;
      }

      // Click fuera de cualquier polígono: cerrar menú contextual
      if (this.selectedPolygon) {
        this.selectedPolygon = null;
        this.usaStatesService.setSelectedPolygon(null);
        this.polygonActionMenuPosition = null;
        this.polygonVectorLayer?.changed();
      }

      const stateFeature = this.map.forEachFeatureAtPixel(
        pixel,
        (feature) => feature,
        { layerFilter: (layer) => layer.get('name') === 'StatesLayer' }
      ) as Feature<Geometry> | undefined;

      if (stateFeature) {
        const properties = stateFeature.getProperties();
        const selectedState = this.stateList.find(
          (state) => state.code === properties['ste_code'][0]
        );
        if (selectedState) {
          this.usaStatesService.selectState(
            selectedState,
            !selectedState.selected
          );
        }
      }
    }
  }

  private showTooltip(coordinate: number[], stateName: string) {
    this.tooltipElement.style.display = 'block';
    this.tooltipElement.innerHTML = stateName;

    const position = this.map.getPixelFromCoordinate(coordinate);
    this.tooltipElement.style.left = position[0] + 18 + 'px';
    this.tooltipElement.style.top = position[1] + 25 + 'px';
  }

  private hideTooltip() {
    this.tooltipElement.style.display = 'none';
  }

  private getFeaturesInsidePolygon(polygon: Polygon): Feature[] {
    const geoJsonFormat = new GeoJSON();
    const geoJsonPolygon = geoJsonFormat.writeGeometryObject(polygon);

    return this.statesFeatures.filter((feature: Feature) => {
      const geoJsonFeature = geoJsonFormat.writeFeatureObject(feature);

      const intersects = booleanIntersects(geoJsonFeature, geoJsonPolygon);

      return intersects;
    });
  }

  private selectStatesByPolygon(polygon: Polygon, active: boolean): void {
    const featuresInsidePolygon = this.getFeaturesInsidePolygon(polygon);

    featuresInsidePolygon!.forEach((feature: any) => {
      const filterState = this.stateList.find(
        (state) => state.code === feature.getProperties()['ste_code'][0]
      );
      this.usaStatesService.selectState(filterState!, active);
    });
  }

  setDragAndDropInteraction(): void {
    if (this.dragAndDropInteraction) {
      this.deactivateAllInteractionTool();
      this.disabledActions = false;
    } else {
      this.deactivateAllInteractionTool();
      // bloquear seleccion y tooltip
      this.disabledActions = true;
      this.dragAndDropInteraction = new DragAndDrop({
        formatConstructors: [
          GeoJSON,
          new TopoJSON(),
        ],
      });

      this.map.addInteraction(this.dragAndDropInteraction);

      this.dragAndDropInteraction.on('addfeatures', (event) => {
        const vectorSource = new VectorSource({
          features: event.features,
        });
        const vectorLayer = new VectorLayer({
          source: vectorSource,
        });

        // Logica para poder asignar un nombre unico a la capa
        let newLayerName = 'ExternalLayer';
        let increaseNumber = 1;
        while (this.existLayerName(newLayerName)) {
          newLayerName = `ExternalLayer-${increaseNumber}`;
          increaseNumber++;
        }
        vectorLayer.set('name', newLayerName);
        this.map.addLayer(vectorLayer);
        this.usaStatesService.manageMapLayer(true, vectorLayer);
        this.map.getView().fit(vectorSource.getExtent());
        this.deactivateAllInteractionTool();
        this.disabledActions = false;
      });
    }
  }

  activateDrawLine(): void {
    if (this.drawLine) {
      this.deactivateAllInteractionTool();
      this.disabledActions = false;
    } else {
      this.deactivateAllInteractionTool();
      // bloquear seleccion y tooltip
      this.disabledActions = true;

      this.drawLine = new Draw({
        type: 'LineString',
        maxPoints: 2,
      });
      this.map.addInteraction(this.drawLine);
      this.drawLine.on("drawend", event => {
        const feature = event.feature;
        const coordinates = (feature.getGeometry() as LineString).getCoordinates()!;

        this.getSplits(coordinates);
        this.deactivateAllInteractionTool();
        setTimeout(() => {
          this.disabledActions = false;
        }, 500);
      });
    }
  }

  getSplits(coordinates: any) {
    this.polygonVectorSource.forEachFeature((feature: Feature) => {
      const geometry = feature.getGeometry();
      if (geometry instanceof Polygon) {
        const polygonCoordinates = geometry.getCoordinates();
        const splits = this.split(polygonCoordinates, coordinates);
        if (splits) {
          this.polygonVectorSource.removeFeature(feature);
          splits.forEach((split: any) => {
            this.addFeatrueFromCoordinates(split);
          });
        }
      }
    });
  }

  addFeature(geometry: any, constr: any) {
    const geom = new constr(geometry);
    const feature = new Feature();
    feature.setGeometry(geom);
    this.polygonVectorSource.addFeature(feature);
    this.polygonVectorLayer?.changed();
  }

  split(polyCoords: any, lineCoords: any) {
    if (this.lineSplitsPoly(polyCoords, lineCoords)) {
      const polygon1 = turfHelpers.polygon(polyCoords);
      const polygon2 = turfHelpers.polygon(this.line2Poly(lineCoords));
      const difference = turfDifference(turf.featureCollection([polygon1, polygon2]));
      if (difference!.geometry.coordinates.length > 1) {
        return this.flatDifference(difference!.geometry.coordinates);
      }
    }
    return null;
  }

  lineSplitsPoly(polyCoords: any, lineCoords: any) {
    const poly = turfHelpers.polygon(polyCoords);
    const point1 = turfHelpers.point(lineCoords[0]);
    const point2 = turfHelpers.point(lineCoords[1]);
    return !pointInPolygon(point1, poly) && !pointInPolygon(point2, poly);
  }

  line2Poly(lineCoords: any) {
    const point_3 = [lineCoords[0][0], lineCoords[0][1] - 1];
    const point_4 = [lineCoords[1][0], lineCoords[1][1] - 1];
    return [[...lineCoords, point_4, point_3, lineCoords[0]]];
  }

  flatDifference(difference: any[]) {
    return difference.reduce(
      (prev: any[], curr: any[]) =>
        prev.concat(curr.length === 1 ? [curr] : curr.map(c => [c])),
      []
    );
  }

  intersectPolygons() {
    if (this.drawPolygonCut) {
      this.deactivateAllInteractionTool();
      this.disabledActions = false;
    } else {
      this.deactivateAllInteractionTool();
      // bloquear seleccion y tooltip
      this.disabledActions = true;

      // crear un nuevo poligono y agregarlo al vectorSource
      this.drawPolygonCut = new Draw({
        type: 'Polygon',
      });
      this.map.addInteraction(this.drawPolygonCut);

      this.drawPolygonCut.on('drawend', (event) => {
        const feature = event.feature;

        this.setSelectedFeature(feature);
        const polygonGeometryCut: Polygon = feature.getGeometry() as Polygon;
        // obtener objeto de poligono en formato turf
        const polygonGeoJsonCut = turf.polygon(
          polygonGeometryCut.getCoordinates()
        );

        // recorrer los poligonos existentes
        this.polygonVectorSource.getFeatures().forEach((polygonFeature) => {
          const polygonGeometry = polygonFeature.getGeometry() as Polygon;
          // obtener el poligo iterado en formato turf
          const polygonGeoJson = turf.polygon(polygonGeometry.getCoordinates());

          if (
            turf.booleanIntersects(polygonGeoJson, polygonGeoJsonCut) &&
            !turf.booleanContains(polygonGeoJson, polygonGeoJsonCut) &&
            !turf.booleanContains(polygonGeoJsonCut, polygonGeoJson)
          ) {
            // si los poligonos se cruzan y ademas no debe de contener ninguno al otro, calcular la diferencia entre los dos poligonos
            const resultPolygon = turf.difference(
              turf.featureCollection([polygonGeoJson, polygonGeoJsonCut])
            );

            this.polygonVectorSource.removeFeature(polygonFeature);
            if (resultPolygon?.geometry.type == 'Polygon') {
              const newCoordinates = resultPolygon!.geometry.coordinates;
              this.addFeatrueFromCoordinates(newCoordinates);
            } else if (resultPolygon?.geometry.type == 'MultiPolygon') {
              resultPolygon!.geometry.coordinates.forEach((newCoordinates) => {
                this.addFeatrueFromCoordinates(newCoordinates);
              });
            }

            if (!this.polygonVectorSource.hasFeature(feature)) {
              // agregamos la nueva geometria solo si no lo esta
              this.polygonVectorSource.addFeature(feature);
            }

            // Marcar como seleccionados los estados de la nueva geometria
            this.selectStatesByPolygon(polygonGeometryCut, true);
          }

          this.deactivateAllInteractionTool();
          setTimeout(() => {
            this.disabledActions = false;
          }, 500);
        });
      });
    }
  }

  intersectContainPolygon() {
    if (this.drawPolygonContainCut) {
      this.deactivateAllInteractionTool();
      this.disabledActions = false;
    } else {
      this.deactivateAllInteractionTool();
      // bloquear seleccion y tooltip
      this.disabledActions = true;

      // crear un nuevo poligono y agregarlo al vectorSource
      this.drawPolygonContainCut = new Draw({
        type: 'Polygon',
      });
      this.map.addInteraction(this.drawPolygonContainCut);

      this.drawPolygonContainCut.on('drawend', (event) => {
        const feature = event.feature;

        this.setSelectedFeature(feature);
        const polygonGeometryCut: Polygon = feature.getGeometry() as Polygon;
        // obtener objeto de poligono en formato turf
        const polygonGeoJsonCut = turf.polygon(
          polygonGeometryCut.getCoordinates()
        );

        // recorrer los poligonos existentes
        this.polygonVectorSource.getFeatures().forEach((polygonFeature) => {
          const polygonGeometry = polygonFeature.getGeometry() as Polygon;
          // obtener el poligo iterado en formato turf
          const polygonGeoJson = turf.polygon(polygonGeometry.getCoordinates());

          if (
            turf.booleanIntersects(polygonGeoJson, polygonGeoJsonCut) &&
            turf.booleanContains(polygonGeoJson, polygonGeoJsonCut)
          ) {
            // si los poligonos se cruzan y ademas no debe de contener ninguno al otro, calcular la diferencia entre los dos poligonos
            const resultPolygon = turf.difference(
              turf.featureCollection([polygonGeoJson, polygonGeoJsonCut])
            );

            this.polygonVectorSource.removeFeature(polygonFeature);
            const newCoordinates = resultPolygon!.geometry.coordinates;
            this.addFeatrueFromCoordinates(newCoordinates);

            if (!this.polygonVectorSource.hasFeature(feature)) {
              // agregamos la nueva geometria solo si no lo esta
              this.polygonVectorSource.addFeature(feature);
            }

            // Marcar como seleccionados los estados de la nueva geometria
            this.selectStatesByPolygon(polygonGeometryCut, true);
          }

          this.deactivateAllInteractionTool();
          setTimeout(() => {
            this.disabledActions = false;
          }, 500);
        });
      });
    }
  }

  unionPolygons() {
    if (this.drawPolygonUnion) {
      this.deactivateAllInteractionTool();
      this.disabledActions = false;
    } else {
      this.deactivateAllInteractionTool();
      // bloquear seleccion y tooltip
      this.disabledActions = true;

      // crear un nuevo poligono y agregarlo al vectorSource
      this.drawPolygonUnion = new Draw({
        type: 'Polygon',
      });
      this.map.addInteraction(this.drawPolygonUnion);

      this.drawPolygonUnion.on('drawend', (event) => {
        const feature = event.feature;


        const polygonGeometryAdd: Polygon = feature.getGeometry() as Polygon;
        // obtener objeto de poligono en formato turf
        const polygonGeoJsonAdd = turf.polygon(
          polygonGeometryAdd.getCoordinates()
        );

        // recorrer los poligonos existentes
        this.polygonVectorSource.getFeatures().forEach((polygonFeature) => {
          const polygonGeometry = polygonFeature.getGeometry() as Polygon;
          // obtener el poligo iterado en formato turf
          const polygonGeoJson = turf.polygon(polygonGeometry.getCoordinates());

          if (turf.booleanIntersects(polygonGeoJson, polygonGeoJsonAdd)) {
            const resultPolygon = turf.union(
              turf.featureCollection([polygonGeoJson, polygonGeoJsonAdd])
            );

            this.polygonVectorSource.removeFeature(polygonFeature);
            const newCoordinates = resultPolygon!.geometry.coordinates;
            const newFeature = this.addFeatrueFromCoordinates(newCoordinates);
            this.setSelectedFeature(newFeature);
            // Marcar como seleccionados los estados de la nueva geometria
            this.selectStatesByPolygon(polygonGeometryAdd, true);
          }
          this.deactivateAllInteractionTool();
          setTimeout(() => {
            this.disabledActions = false;
          }, 500);
        });
      });
    }
  }

  private addFeatrueFromCoordinates(newCoordinates: any): Feature {
    const newPolygonFeature =
      this.createPolygonFeatureFromCoordinates(newCoordinates);

    this.polygonVectorSource.addFeature(newPolygonFeature);
    return newPolygonFeature;
  }

  private createPolygonFeatureFromCoordinates(coordinates: any) {
    const polygonGeometry = new Polygon(coordinates);
    return new Feature({
      geometry: polygonGeometry,
    });
  }

  activateDrawPolygon(): void {
    if (this.drawPolygon) {
      this.deactivateAllInteractionTool();
      this.disabledActions = false;
    } else {
      this.deactivateAllInteractionTool();
      this.disabledActions = true;

      this.drawPolygon = new Draw({
        source: this.polygonVectorSource,
        type: 'Polygon',
      });
      this.map.addInteraction(this.drawPolygon);

      this.drawPolygon.on('drawend', (event) => {
        const feature = event.feature;

        this.setSelectedFeature(feature);
        const polygonGeometry: Polygon = feature.getGeometry() as Polygon;
        const extent = polygonGeometry!.getExtent();

        const view = this.map.getView();
        const center = view.getCenter();
        if (center) {
          const convertedCenter = toLonLat(center);
          if (convertedCenter.length >= 2) {
            this.initialCenter = [convertedCenter[0], convertedCenter[1]];
          }
        }
        this.initialZoom = view.getZoom() ?? 0;

        view.fit(extent, {
          size: this.map.getSize(),
          padding: [50, 50, 50, 50],
          maxZoom: 13,
        });

        this.selectStatesByPolygon(polygonGeometry, true);
        this.deactivateAllInteractionTool();
        setTimeout(() => {
          this.disabledActions = false;
        }, 500);
      });
    }
  }

  removeSelectFeature(): void {
    const polygonGeometry: Polygon =
      this.selectedPolygon!.getGeometry() as Polygon;
    this.selectStatesByPolygon(polygonGeometry, false);

    const isLastPolygon =
      this.polygonVectorSource.getFeatures().length <= 1;
    if (
      isLastPolygon &&
      this.initialCenter &&
      this.initialZoom !== null
    ) {
      this.map.getView().setCenter(fromLonLat(this.initialCenter));
      this.map.getView().setZoom(this.initialZoom);
    }

    this.vectorSource.removeFeature(this.selectedPolygon!);
    this.polygonVectorSource.removeFeature(this.selectedPolygon!);
    this.selectedPolygon = null;
    this.usaStatesService.setSelectedPolygon(null);
    this.polygonActionMenuPosition = null;
    this.polygonVectorLayer?.changed();
    this.updateSelectedStatesByPolygon();
  }

  hasDrwanPolygons(): boolean {
    if (this.polygonVectorSource) {
      return this.polygonVectorSource!.getFeatures().length > 0;
    } else {
      return false;
    }
  }

  // recorre todos los poligonos que hay en el vector para marcar sus estados como seleccionados
  updateSelectedStatesByPolygon() {
    this.polygonVectorSource.getFeatures().forEach((feature) => {
      const polygonGeometry = feature.getGeometry() as Polygon;
      this.selectStatesByPolygon(polygonGeometry, true);
    });
  }

  activateModifyTool(): void {
    if (this.modifyInteraction) {
      this.deactivateAllInteractionTool();
      this.disabledActions = false;
    } else {
      this.disabledActions = true;
      this.deactivateAllInteractionTool();

      let oldPolygon: Polygon;

      this.modifyInteraction = new Modify({
        source: this.polygonVectorSource,
      });
      this.map.addInteraction(this.modifyInteraction);

      this.modifyInteraction.on('modifystart', (event) => {
        const selectedFeatures = event.features;
        selectedFeatures.forEach((feature) => {
          oldPolygon = feature.getGeometry()!.clone() as Polygon;
        });
      });

      this.modifyInteraction.on('modifyend', () => {
        // Desseleccionar los estados del polígono anterior
        this.selectStatesByPolygon(oldPolygon, false);

        this.updateSelectedStatesByPolygon();
        this.deactivateAllInteractionTool();
        setTimeout(() => {
          this.disabledActions = false;
        }, 500);
      });

      this.select = new Select({
        condition: click,
        layers: [this.polygonVectorLayer],
        filter: (feature) => {
          return feature.getProperties()['ste_code'] == undefined;
        },
      });

      this.map.addInteraction(this.select);
    }
  }

  activateTranformTool(): void {
    if (this.translateInteraction) {
      this.deactivateAllInteractionTool();
      this.disabledActions = false;
    } else {
      this.deactivateAllInteractionTool();
      this.disabledActions = true;

      let oldPolygon: Polygon;

      this.select = new Select({
        condition: click,
        filter: (feature) => this.polygonVectorSource.hasFeature(feature),
      });

      this.map.addInteraction(this.select);

      this.translateInteraction = new Transform({
        layers: [this.polygonVectorLayer],
        scale: true,
        rotate: true,
        translate: true,
        stretch: true,
        selection: true,
      });
      this.map.addInteraction(this.translateInteraction!);

      this.translateInteraction!.on('translatestart', (event) => {
        const selectedFeatures = event.features;
        selectedFeatures.forEach((feature) => {
          oldPolygon = feature.getGeometry()!.clone() as Polygon;
        });
      });

      // Escuchar el evento de transforamcion y actualizar la seleccion
      this.translateInteraction!.on('translateend', (event) => {
        // Desseleccionar los estados del polígono anterior
        this.selectStatesByPolygon(oldPolygon, false);

        this.updateSelectedStatesByPolygon();
        // this.deactivateAllInteractionTool();
      });
    }
  }

  // Desactivar todas las herramientas de interacción
  deactivateAllInteractionTool(): void {
    if (this.drawPolygon) {
      this.map.removeInteraction(this.drawPolygon);
      this.drawPolygon = null;
    }
    if (this.drawPolygonCut) {
      this.map.removeInteraction(this.drawPolygonCut);
      this.drawPolygonCut = null;
    }
    if (this.drawPolygonUnion) {
      this.map.removeInteraction(this.drawPolygonUnion);
      this.drawPolygonUnion = null;
    }
    if (this.drawPolygonContainCut) {
      this.map.removeInteraction(this.drawPolygonContainCut);
      this.drawPolygonContainCut = null;
    }
    if (this.drawLine) {
      this.map.removeInteraction(this.drawLine);
      this.drawLine = null;
    }
    if (this.select) {
      this.map.removeInteraction(this.select);
      this.select = null;
    }

    if (this.modifyInteraction) {
      this.map.removeInteraction(this.modifyInteraction);
      this.modifyInteraction = null;
    }

    if (this.translateInteraction) {
      this.map.removeInteraction(this.translateInteraction);
      this.translateInteraction = null;
    }
    if (this.dragAndDropInteraction) {
      this.map.removeInteraction(this.dragAndDropInteraction);
      this.dragAndDropInteraction = null;
    }

  }

  /** Polígonos dibujados: resalta en azul el que está seleccionado (p. ej. para borrar). */
  private getPolygonFeatureStyle(feature: Feature): Style {
    const selected = this.selectedPolygon === feature;
    return new Style({
      stroke: new Stroke({
        color: selected ? 'rgb(255, 0, 132)' : 'rgba(59, 130, 246, 1)',
        width: selected ? 3 : 2,
      }),
      fill: new Fill({
        color: selected
          ? 'rgba(255, 0, 132, 0.35)'
          : 'rgba(96, 165, 250, 0.12)',
      }),
    });
  }

  private getStyle(feature: any) {
    const properties = feature.getProperties();
    const featureCode = properties['ste_code']
      ? properties['ste_code'][0]
      : null;

    let filterState: StateInterface | undefined;
    if (featureCode) {
      filterState = this.stateList.find((state) => state.code === featureCode);
    }

    if (!filterState || !filterState.totalPopulation) {
      return new Style({
        stroke: new Stroke({
          color: 'rgba(0, 0, 255, 0.3)',
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(0, 0, 255, 0.1)',
        }),
      });
    }

    const povertyRatio = filterState.peopleInPoverty / filterState.totalPopulation;
    let fillColor = 'rgb(0, 255, 0)';

    if (povertyRatio >= 0.17) {
      fillColor = 'rgb(255, 0, 0)';
    } else if (povertyRatio >= 0.14) {
      fillColor = 'rgb(255, 165, 0)';
    } else if (povertyRatio >= 0.11) {
      fillColor = 'rgb(255, 255, 0)';
    }

    // Si está seleccionado: mantener el color por pobreza (verde/amarillo/naranja/rojo)
    if (filterState.selected) {
      const base = new Style({
        stroke: new Stroke({
          color: 'rgb(59, 130, 246)',
          width: 2,
        }),
        fill: new Fill({
          color: fillColor,
        }),
      });

      // “Velo” azul encima para dar tono azulado sin perder el gradiente de pobreza.
      const blueTint = new Style({
        fill: new Fill({
          color: 'rgba(59, 130, 246, 0.55)',
        }),
      });

      return [base, blueTint];
    }

    return new Style({
      stroke: new Stroke({
        color: 'rgba(0, 0, 255, 0.3)',
        width: 2,
      }),
      fill: new Fill({
        color: fillColor,
      }),
    });
  }

  openComparedComponent(): void {
    if (!this.selectedPolygon) {
      this.dialog.open(ErrorDialogComponent, { width: '250px' });
      return;
    }
    const geom = this.selectedPolygon.getGeometry();
    if (!(geom instanceof Polygon)) {
      this.dialog.open(ErrorDialogComponent, { width: '250px' });
      return;
    }

    const intersectingFeatures = this.getFeaturesInsidePolygon(geom);
    const intersectingStates: StateInterface[] = intersectingFeatures
      .map((feature) => feature.getProperties()?.['ste_code']?.[0])
      .filter((code): code is string => !!code)
      .map((code) => this.stateList.find((s) => s.code === code))
      .filter((s): s is StateInterface => !!s);

    // De-duplicar (por si hay geometrías raras) manteniendo orden estable
    const seenCodes: Record<string, true> = {};
    const statesToCompare: StateInterface[] = [];
    for (const s of intersectingStates) {
      if (!seenCodes[s.code]) {
        seenCodes[s.code] = true;
        statesToCompare.push(s);
      }
    }

    if (statesToCompare.length > 1) {
      this.comparedStates = true;
      this.statesToCompare = statesToCompare;
    } else {
      this.dialog.open(ErrorDialogComponent, { width: '250px' });
    }
  }

  closeModal() {
    this.comparedStates = false;
  }

  changeViewMode(viewMode: ViewMode) {
    this.usaStatesService.setViewMode(viewMode);
  }

  existLayerName(name: string): boolean {
    const layers = this.map.getLayers().getArray();
    const layerFiltered = layers.find(layer => layer.get('name') === name);
    return layerFiltered ? true : false
  }


}
