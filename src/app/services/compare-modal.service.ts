import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StateInterface } from '../components/model/state-interface';

/** Modal de comparación a nivel raíz: evita quedar bajo el panel swipe (stacking del mapa). */
@Injectable({ providedIn: 'root' })
export class CompareModalService {
  private readonly _states = new BehaviorSubject<StateInterface[] | null>(null);
  readonly states$ = this._states.asObservable();

  open(states: StateInterface[]): void {
    if (states.length > 1) {
      this._states.next(states);
    }
  }

  close(): void {
    this._states.next(null);
  }
}
