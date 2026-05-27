import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LanguageSwitcherComponent } from '../i18n/language-switcher/language-switcher.component';
import { TocComponent } from '../map/toc/toc.component';

@Component({
  selector: 'rima-root',
  imports: [RouterOutlet, TranslocoModule, LanguageSwitcherComponent, TocComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
