import { inject, Injectable } from '@angular/core';
import { LanguageEffect } from '../i18n/language-effects';
import { PopupEffects } from '../map/information-pane/popup-effects';
import { AttributesEffects } from '../map/information-pane/attributes-tab/attributes-effects';
import { HierarchyEffects } from '../map/information-pane/hierarchy-tab/hierarchy-effects';
import { HistoryEffects } from '../map/history/history-effects';
import { ViewEffects } from '../map/view/view-effects';
import { DocumentsEffects } from '../map/information-pane/documents-tab/documents-effects';

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
    inject(AttributesEffects);
    inject(HierarchyEffects);
    inject(HistoryEffects);
    inject(DocumentsEffects);
    inject(ViewEffects);
  }
}
