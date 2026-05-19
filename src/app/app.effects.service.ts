import { inject, Injectable } from '@angular/core';
import { LanguageService } from '../i18n/language.service';

@Injectable({
  providedIn: 'root',
})
export class AppEffectsService {
  constructor() {
    /**
     * The Effect Services are all registering their effects in their constructors.
     * @private
     */
    inject(LanguageService);
  }
}
