import { Component, inject } from '@angular/core';
import { TranslocoService, TranslocoModule } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { Language } from '../language';
import { languageConfig } from '../language.config';

@Component({
  selector: 'rima-language-switcher',
  imports: [TranslocoModule],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
})
export class LanguageSwitcherComponent {
  private readonly translocoService = inject(TranslocoService);

  protected readonly languages = languageConfig.availableLanguages;
  protected readonly activeLanguage = toSignal(this.translocoService.langChanges$, {
    initialValue: this.translocoService.getActiveLang(),
  });

  protected changeLanguage(language: Language): void {
    this.translocoService.setActiveLang(language);
  }
}
