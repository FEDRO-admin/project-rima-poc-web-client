import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  ErrorHandler,
  provideAppInitializer,
  inject,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { ErrorHandlerService } from '../error-handling/error-handler.service';
import { AppEffectsService } from './app-effects.service';
import { languageConfig } from '../i18n/language-types';
import { TranslocoHttpLoader } from '../i18n/transloco/transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideAppInitializer(() => {
      inject(AppEffectsService);
    }),
    provideTransloco({
      config: {
        availableLangs: [...languageConfig.availableLanguages],
        defaultLang: languageConfig.defaultLanguage,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    { provide: ErrorHandler, useClass: ErrorHandlerService },
  ],
};
