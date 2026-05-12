import { Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { Language } from '../language';
import { LanguageStore } from '../../stores/language.store';

@Component({
  selector: 'rima-language-switcher',
  imports: [TranslocoModule],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
})
export class LanguageSwitcherComponent {
  protected readonly languageStore = inject(LanguageStore);

  protected readonly languages = this.languageStore.availableLanguages;
  protected readonly activeLanguage = this.languageStore.activeLanguage;

  protected changeLanguage(language: Language): void {
    this.languageStore.setLanguage(language);
  }
}
