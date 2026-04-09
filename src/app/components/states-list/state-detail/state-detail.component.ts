import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { StateInterface } from '../../model/state-interface';
import { CommonModule } from '@angular/common';

import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-state-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './state-detail.component.html',
  styleUrl: './state-detail.component.scss'
})
export class StateDetailComponent implements OnInit {
  @Input() state!: StateInterface;
  @Output() close = new EventEmitter<void>();

  literals: any = {};
  povertyPercentage = 0;
  unemployedPercentage = 0;
  noInsurancePercentage = 0;

  constructor(public languageService: LanguageService) { }

  ngOnInit(): void {
    this.languageService.literals$.subscribe((literals) => {
      this.literals = literals;
    });

    if (this.state && this.state.totalPopulation) {
      this.povertyPercentage = (this.state.peopleInPoverty / this.state.totalPopulation) * 100;
      this.unemployedPercentage = (this.state.unemployed / this.state.totalPopulation) * 100;
      this.noInsurancePercentage = (this.state.noHealthInsurance / this.state.totalPopulation) * 100;
    }
  }

  closeModal() {
    this.close.emit();
  }

}
