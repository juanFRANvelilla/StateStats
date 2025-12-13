import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LanguageService {
    private literalsSubject = new BehaviorSubject<any>({});
    literals$ = this.literalsSubject.asObservable();
    currentLang = 'es';

    constructor(private http: HttpClient) {
        const savedLang = localStorage.getItem('lang');
        if (savedLang) {
            this.currentLang = savedLang;
        }
        this.loadLanguage(this.currentLang);
    }

    changeLanguage(lang: string) {
        this.currentLang = lang;
        localStorage.setItem('lang', lang);
        this.loadLanguage(lang);
    }

    private loadLanguage(lang: string) {
        this.http.get(`assets/i18n/${lang}.json`).subscribe((data: any) => {
            this.literalsSubject.next(data);
        });
    }
}
