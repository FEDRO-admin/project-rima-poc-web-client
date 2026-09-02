import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { setLocale } from '@arcgis/core/intl';
import { LanguageStore } from './language.store';
@Injectable({
  providedIn: 'root',
})
export class LanguageEffect {
  private readonly translocoService = inject(TranslocoService);
  private readonly languageStore = inject(LanguageStore);
  private readonly document = inject(DOCUMENT);

  constructor() {
    effect(() => {
      const activeLanguage = this.languageStore.activeLanguage();
      untracked(() => {
        this.translocoService.setActiveLang(activeLanguage);
        // Syncs ArcGIS/Calcite web components, which read locale from the root `lang` attribute
        this.document.documentElement.lang = activeLanguage;
        // Syncs @arcgis/core internals (date/number formatting, popups, basemap place labels)
        setLocale(activeLanguage);
      });
    });
  }
}
