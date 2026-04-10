import { Component, DestroyRef, HostListener, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UsaMapComponent } from './components/usa-map/usa-map.component';
import { StatesListComponent } from './components/states-list/states-list.component';
import { StateComparedComponent } from './components/states-list/state-compared/state-compared.component';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { CompareModalService } from './services/compare-modal.service';
import { StateInterface } from './components/model/state-interface';

const MOBILE_BREAKPOINT_PX = 600;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [UsaMapComponent, StatesListComponent, StateComparedComponent, HttpClientModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'demo-open-layers';

  private readonly _compareModal = inject(CompareModalService);
  private readonly _destroyRef = inject(DestroyRef);

  /** Estados del modal de comparación (null = cerrado). Render en raíz, encima del panel móvil. */
  compareModalStates: StateInterface[] | null = null;

  /** Vista móvil: mapa a pantalla completa y lista en panel inferior (ver MOBILE_BREAKPOINT_PX). */
  isMobile = false;
  /** Altura del panel inferior como % del viewport (0 = cerrado). */
  sheetHeightPercent = 0;
  private sheetDragging = false;
  private dragStartY = 0;
  private dragStartPercent = 0;
  private sheetResizeRafId = 0;

  ngOnInit(): void {
    this.updateMobileLayout();
    this._compareModal.states$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((states) => {
        this.compareModalStates = states;
      });
  }

  closeCompareModal(): void {
    this._compareModal.close();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateMobileLayout();
  }

  private updateMobileLayout(): void {
    const next = window.innerWidth < MOBILE_BREAKPOINT_PX;
    if (!next && this.isMobile) {
      this.sheetHeightPercent = 0;
    }
    this.isMobile = next;
    this.scheduleMapResize();
  }

  get mobileSheetClosed(): boolean {
    return this.sheetHeightPercent <= 0;
  }

  openMobileSheet(): void {
    this.sheetHeightPercent = 50;
    this.scheduleMapResize();
  }

  closeMobileSheet(): void {
    this.sheetHeightPercent = 0;
    this.scheduleMapResize();
  }

  onSheetPointerDown(ev: PointerEvent): void {
    if ((ev.target as HTMLElement).closest('.mobile-sheet-close')) {
      return;
    }
    ev.preventDefault();
    this.sheetDragging = true;
    this.dragStartY = ev.clientY;
    this.dragStartPercent = this.sheetHeightPercent;
  }

  @HostListener('document:pointermove', ['$event'])
  onSheetPointerMove(ev: PointerEvent): void {
    if (!this.sheetDragging || !this.isMobile) {
      return;
    }
    const vh = window.innerHeight;
    if (vh <= 0) {
      return;
    }
    const dy = ev.clientY - this.dragStartY;
    const deltaPct = (dy / vh) * 100;
    let next = this.dragStartPercent - deltaPct;
    next = Math.max(0, Math.min(100, next));
    this.sheetHeightPercent = next;
    if (this.sheetResizeRafId === 0) {
      this.sheetResizeRafId = requestAnimationFrame(() => {
        this.sheetResizeRafId = 0;
        this.scheduleMapResize();
      });
    }
  }

  @HostListener('document:pointerup', ['$event'])
  onSheetPointerUp(): void {
    if (!this.sheetDragging) {
      return;
    }
    this.sheetDragging = false;
    if (this.sheetHeightPercent < 20) {
      this.sheetHeightPercent = 0;
    } else if (this.sheetHeightPercent > 90) {
      this.sheetHeightPercent = 100;
    }
    this.scheduleMapResize();
  }

  private scheduleMapResize(): void {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 0);
  }
}
