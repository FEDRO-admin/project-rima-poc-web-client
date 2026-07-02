import { inject, Injectable } from '@angular/core';
import { LanguageEffect } from '../i18n/language-effects';
import { PopupEffects } from '../map/popup/popup-effects';
import { EditEffects } from '../map/edit/edit-effects';
import { CreateEffects } from '../map/create/create-effects';
import { DeleteEffects } from '../map/delete/delete-effects';
import { HierarchyEffects } from '../map/popup/content/hierarchy-tab/hierarchy-effects';

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
    inject(EditEffects);
    inject(CreateEffects);
    inject(DeleteEffects);
    inject(HierarchyEffects);
  }
}
