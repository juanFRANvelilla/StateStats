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

  casesOpen = true;
  hospitalizationOpen = true;
  testsOpen = true;
  literals: any = {};

  constructor(public languageService: LanguageService) { }

  ngOnInit(): void {
    this.languageService.literals$.subscribe((literals) => {
      this.literals = literals;
    });
  }

  closeModal() {
    this.close.emit();
  }

}
