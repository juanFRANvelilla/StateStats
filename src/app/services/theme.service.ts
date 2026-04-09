import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'themeDark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly isDark = signal(this.readInitial());

  constructor() {
    this.syncBodyClass();
  }

  setDark(value: boolean): void {
    this.isDark.set(value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    }
    this.syncBodyClass();
  }

  toggle(): void {
    this.setDark(!this.isDark());
  }

  private readInitial(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  private syncBodyClass(): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.classList.toggle('app-dark-theme', this.isDark());
  }
}
