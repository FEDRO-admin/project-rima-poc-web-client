import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  ErrorHandler,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { TranslocoHttpLoader } from '../i18n/transloco-loader';
import { languageConfig } from '../i18n/language.config';
import { ErrorHandlerService } from '../error-handling/error-handler.service';
import { LayersStore } from '../stores/layers.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: languageConfig.availableLanguages,
        defaultLang: languageConfig.defaultLanguage,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    { provide: ErrorHandler, useClass: ErrorHandlerService },
    provideAppInitializer(() => {
      void inject(LayersStore).initialize();
    }),
  ],
};
