import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { StateInterface } from '../../model/state-interface';
import { CommonModule } from '@angular/common';

import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-state-compared',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './state-compared.component.html',
  styleUrl: './state-compared.component.scss'
})
export class StateComparedComponent implements OnInit {
  @Input() states?: any[];
  @Output() close = new EventEmitter<void>();

  literals: any = {};

  constructor(public languageService: LanguageService) { }

  ngOnInit(): void {
    this.languageService.literals$.subscribe((literals) => {
      this.literals = literals;
    });

    if (this.states && this.states.length > 0) {
      // 1. Calculate percentages
      this.states = this.states.map(state => ({
        ...state,
        povertyPercentage: state.totalPopulation ? (state.peopleInPoverty / state.totalPopulation) * 100 : 0,
        unemployedPercentage: state.totalPopulation ? (state.unemployed / state.totalPopulation) * 100 : 0,
        noInsurancePercentage: state.totalPopulation ? (state.noHealthInsurance / state.totalPopulation) * 100 : 0,
      }));

      // 2. Obtain min and max for each metric to build the gradient
      const minIncome = Math.min(...this.states.map(s => s.medianIncome));
      const maxIncome = Math.max(...this.states.map(s => s.medianIncome));

      const minPoverty = Math.min(...this.states.map(s => s.povertyPercentage));
      const maxPoverty = Math.max(...this.states.map(s => s.povertyPercentage));

      const minUnemployed = Math.min(...this.states.map(s => s.unemployedPercentage));
      const maxUnemployed = Math.max(...this.states.map(s => s.unemployedPercentage));

      const minNoInsurance = Math.min(...this.states.map(s => s.noInsurancePercentage));
      const maxNoInsurance = Math.max(...this.states.map(s => s.noInsurancePercentage));

      // 3. Assign colors based on min/max
      this.states = this.states.map(state => ({
        ...state,
        incomeColor: this.getGradientColor(state.medianIncome, minIncome, maxIncome, true),  // Higher is better -> Green
        povertyColor: this.getGradientColor(state.povertyPercentage, minPoverty, maxPoverty, false), // Lower is better -> Green
        unemployedColor: this.getGradientColor(state.unemployedPercentage, minUnemployed, maxUnemployed, false), // Lower is better -> Green
        noInsuranceColor: this.getGradientColor(state.noInsurancePercentage, minNoInsurance, maxNoInsurance, false), // Lower is better -> Green
      }));
    }
  }

  private getGradientColor(value: number, min: number, max: number, higherIsBetter: boolean): string {
    if (min === max) return 'green'; // If all states are equal, they all are the "best" or neutral

    let ratio = (value - min) / (max - min); 
    
    // If higher is better (e.g. median income), we invert the ratio so that the max value gets 0 (green)
    if (higherIsBetter) {
      ratio = 1 - ratio; 
    }

    if (ratio <= 0.25) return 'green';
    if (ratio <= 0.50) return '#d4b000'; // dark yellow/mustard
    if (ratio <= 0.75) return 'orange';
    return 'red';
  }

  closeModal() {
    this.close.emit();
  }

}
