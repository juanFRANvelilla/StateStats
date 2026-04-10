import { Component, Input } from '@angular/core';
import { UsaStatesService } from '../usa-states.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StateInterface } from '../model/state-interface';
import { StateDetailComponent } from './state-detail/state-detail.component';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogComponent } from './error-dialog/error-dialog.component';
import { ViewMode } from '../model/view-mode';
import { Subscription } from 'rxjs';
import { Feature } from 'ol';
import { Polygon } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import { LayerSelected } from '../model/layer-selected';
import { toLonLat } from 'ol/proj';
import { getCenter } from 'ol/extent';
import { getLength as getGeodesicLength } from 'ol/sphere';



import { LanguageService } from '../../services/language.service';
import { CompareModalService } from '../../services/compare-modal.service';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-states-list',
  standalone: true,
  imports: [FormsModule, CommonModule, StateDetailComponent, MatTooltipModule],
  templateUrl: './states-list.component.html',
  styleUrl: './states-list.component.scss'
})
export class StatesListComponent {
  /** Desactiva matTooltip en vista móvil (mismo criterio que app MOBILE_BREAKPOINT_PX). */
  @Input() mobileLayout = false;

  stateList: StateInterface[] = [];
  stateSelected?: StateInterface;
  viewMode: ViewMode = ViewMode.LIST_STATES;
  ViewMode = ViewMode;
  selectedPolygon: Feature | null = null;
  mapLayers: LayerSelected[] = [];
  literals: any = {};

  constructor(
    private usaStatesService: UsaStatesService,
    public dialog: MatDialog,
    public languageService: LanguageService,
    private compareModalService: CompareModalService,
  ) {}

  ngOnInit(): void {
    this.languageService.literals$.subscribe((literals) => {
      this.literals = literals;
    });

    this.usaStatesService.getStateList().subscribe((stateList: StateInterface[]) => {
      this.stateList = stateList;
    });

    this.usaStatesService.getViewMode().subscribe((viewMode: ViewMode) => {
      this.viewMode = viewMode;
    });

    this.usaStatesService.getSelectedPolygon().subscribe((selectedPolygon: Feature | null) => {
      this.selectedPolygon = selectedPolygon;
      if (!selectedPolygon && this.viewMode === ViewMode.POLYGON_AREA) {
        this.usaStatesService.setViewMode(ViewMode.LIST_STATES);
      }
    });

    this.usaStatesService.getMapLayers().subscribe((mapLayers: LayerSelected[]) => {
      this.mapLayers = mapLayers;
    });
  }

  getSelectedPolygonArea(): string {
    const polygon = this.selectedPolygon?.getGeometry() as Polygon;
    const area = polygon.getArea();
    return `${area.toFixed(2)} m²`;
  }

  getSelectedPolygonPerimeter(): string {
    const polygon = this.selectedPolygon?.getGeometry() as Polygon;
    const ring = polygon.getLinearRing(0);
    const perimeter = ring ? getGeodesicLength(ring, { projection: 'EPSG:3857' }) : 0;
    return `${perimeter.toFixed(2)} m`;
  }

  getSelectedPolygonVerticesCount(): number {
    const polygon = this.selectedPolygon?.getGeometry() as Polygon;
    const coords = polygon.getCoordinates()?.[0] ?? [];
    // El último punto suele repetir el primero para cerrar el anillo
    return Math.max(0, coords.length - 1);
  }

  getSelectedPolygonCenter(): string {
    const polygon = this.selectedPolygon?.getGeometry() as Polygon;
    const center3857 = getCenter(polygon.getExtent());
    const [lon, lat] = toLonLat(center3857);
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }

  viewDetails(state: any) {
    this.stateSelected = state;
  }

  closePolygonInfo(): void {
    this.usaStatesService.setViewMode(ViewMode.LIST_STATES);
  }

  isCompareDisabled(): boolean {
    return this.stateList.filter(s => s.selected).length < 2;
  }

  closeModal() {
    this.stateSelected = undefined;
  }

  onSelectedChange(stateSelected: StateInterface) {
    this.usaStatesService.selectState(stateSelected, stateSelected.selected!);
  }

  onStateRowClick(event: MouseEvent, state: StateInterface) {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (target.closest('.view-detail-col')) {
      return;
    }
    if (target.closest('input[type="checkbox"]')) {
      return;
    }
    state.selected = !state.selected;
    this.onSelectedChange(state);
  }

  openComparedComponent() {
    const statesToCompare = this.stateList.filter((state) => state.selected);
    if (statesToCompare.length > 1) {
      this.compareModalService.open(statesToCompare);
    } else {
      this.dialog.open(ErrorDialogComponent, {
        width: '250px',
      });
    }
  }

  onLayerSelectedChange(layerSelected: LayerSelected) {
    this.usaStatesService.manageMapLayer(layerSelected.selected, layerSelected.layer);
  }

  cleanAll() {
    this.usaStatesService.triggerCleanAll();
  }

}
