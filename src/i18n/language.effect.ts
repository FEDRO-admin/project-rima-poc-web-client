import { effect, inject, Injectable, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageStore } from './language.store';
@Injectable({
  providedIn: 'root',
})
export class LanguageEffect {
  private readonly translocoService = inject(TranslocoService);
  private readonly languageStore = inject(LanguageStore);

  constructor() {
    effect(() => {
      const activeLanguage = this.languageStore.activeLanguage();
      untracked(() => {
        this.translocoService.setActiveLang(activeLanguage);
      });
    });
  }
}
