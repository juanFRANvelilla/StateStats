import { Component } from '@angular/core';
import { UsaStatesService } from '../usa-states.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StateInterface } from '../model/state-interface';
import { StateDetailComponent } from './state-detail/state-detail.component';
import { StateComparedComponent } from './state-compared/state-compared.component';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogComponent } from './error-dialog/error-dialog.component';
import { ViewMode } from '../model/view-mode';
import { Subscription } from 'rxjs';
import { Feature } from 'ol';
import { Polygon } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import { LayerSelected } from '../model/layer-selected';



import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-states-list',
  standalone: true,
  imports: [FormsModule, CommonModule, StateDetailComponent, StateComparedComponent],
  templateUrl: './states-list.component.html',
  styleUrl: './states-list.component.scss'
})
export class StatesListComponent {
  stateList: StateInterface[] = [];
  stateSelected?: StateInterface;
  comparedStates: boolean = false;
  statesToCompare: StateInterface[] = [];
  viewMode: ViewMode = ViewMode.LIST_STATES;
  ViewMode = ViewMode;
  selectedPolygon: Feature | null = null;
  mapLayers: LayerSelected[] = [];
  literals: any = {};

  constructor(private usaStatesService: UsaStatesService, public dialog: MatDialog, public languageService: LanguageService) { }

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

  viewDetails(state: any) {
    this.stateSelected = state;
  }

  closeModal() {
    this.stateSelected = undefined;
    this.comparedStates = false;
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
    const statesToCompare = this.stateList.filter(state => state.selected);
    if (statesToCompare.length > 1) {
      this.comparedStates = true;
      this.statesToCompare = statesToCompare;
    } else {
      this.dialog.open(ErrorDialogComponent, {
        width: '250px'
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
