import { inject, Injectable } from '@angular/core';
import { LanguageEffect } from '../i18n/language-effects';
import { PopupEffects } from '../map/popup/popup-effects';

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
    inject(PopupEffects);
  }
}
