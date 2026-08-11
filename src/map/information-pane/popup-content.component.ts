import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import { AttributesTabComponent } from './attributes-tab/attributes-tab.component';
import { HierarchyTabComponent } from './hierarchy-tab/hierarchy-tab.component';
import { DocumentsTabComponent } from './documents-tab/documents-tab.component';
import { StatusComponent } from './status-tab/status.component';
import { ViewStore } from '../view/view.store';
import { ReferencePointComponent } from './reference-tab/reference-point.component';

export type PopupTab = 'attributes' | 'reference' | 'hierarchy' | 'documents' | 'status';

@Component({
  selector: 'rima-popup-content',
  imports: [
    AttributesTabComponent,
    HierarchyTabComponent,
    DocumentsTabComponent,
    ReferencePointComponent,
    StatusComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './popup-content.component.html',
  styleUrl: './popup-content.component.scss',
})
export class PopupContentComponent {
  readonly graphic = input.required<Graphic>();
  readonly activeTab = input.required<PopupTab>();

  protected readonly viewStore = inject(ViewStore);
  readonly refMode = computed<'edit' | 'view'>(() => (this.viewStore.historic() ? 'view' : 'edit'));
}
