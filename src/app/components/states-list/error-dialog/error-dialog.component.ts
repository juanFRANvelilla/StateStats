import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { LanguageService } from '../../../services/language.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-dialog.component.html',
  styleUrl: './error-dialog.component.scss'
})
export class ErrorDialogComponent implements OnInit {
  literals: any = {};

  constructor(public dialogRef: MatDialogRef<ErrorDialogComponent>, public languageService: LanguageService) { }

  ngOnInit(): void {
    this.languageService.literals$.subscribe((literals) => {
      this.literals = literals;
    });
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
