import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  ErrorHandler,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { ErrorHandlerService } from '../error-handling/error-handler.service';
import { AppEffectsService } from './app-effects.service';
import { provideLanguage } from '../i18n/language-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideAppInitializer(() => {
      inject(AppEffectsService);
    }),
    provideLanguage(),
    { provide: ErrorHandler, useClass: ErrorHandlerService },
  ],
};
