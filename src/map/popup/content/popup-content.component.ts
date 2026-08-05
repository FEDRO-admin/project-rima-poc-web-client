import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input, signal } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import { AttributesTabComponent } from './attributes-tab/attributes-tab.component';
import { HierarchyTabComponent } from './hierarchy-tab/hierarchy-tab.component';
import { DocumentsTabComponent } from './documents-tab/documents-tab.component';
import { ReferencePointComponent } from '../../reference/reference-point/reference-point.component';
import { StatusComponent } from '../../status/status.component';
import { ViewStore } from '../../view/view.store';

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
  readonly activeTab = signal<PopupTab>('attributes');
  readonly refMode = computed<'edit' | 'view'>(() => (this.viewStore.historic() ? 'view' : 'edit'));

  readonly title = computed<string>(() => {
    const graphic = this.graphic();
    return graphic.layer?.title ?? 'Feature';
  });

  selectTab(tab: PopupTab): void {
    this.activeTab.set(tab);
  }
}
