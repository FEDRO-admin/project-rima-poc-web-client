import { inject, Injectable } from '@angular/core';
import { LanguageEffect } from '../i18n/language.effect';

@Injectable({
  providedIn: 'root',
})
export class AppEffectsService {
  constructor() {
    /**
     * The Effect Services are all registering their effects in their constructors.
     * @private
     */
    inject(LanguageEffect);
  }
}
