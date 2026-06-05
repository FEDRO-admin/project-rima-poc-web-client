import { Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LanguageStore } from '../language.store';
import { Language } from '../language';

@Component({
  selector: 'rima-language-switcher',
  imports: [TranslocoModule],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
})
export class LanguageSwitcherComponent {
  protected readonly languageStore = inject(LanguageStore);

  protected changeLanguage(language: Language): void {
    this.languageStore.setActiveLanguage(language);
  }
}
