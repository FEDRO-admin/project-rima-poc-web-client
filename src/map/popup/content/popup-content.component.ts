import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import { AttributesTabComponent } from './attributes-tab/attributes-tab.component';
import { HierarchyTabComponent } from './hierarchy-tab/hierarchy-tab.component';
import { DocumentsTabComponent } from './documents-tab/documents-tab.component';
import { ReferencePointViewComponent } from '../../reference/reference-point-view/reference-point-view.component';

export type PopupTab = 'attributes' | 'hierarchy' | 'documents';

@Component({
  selector: 'rima-popup-content',
  imports: [AttributesTabComponent, HierarchyTabComponent, DocumentsTabComponent, ReferencePointViewComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './popup-content.component.html',
  styleUrl: './popup-content.component.scss',
})
export class PopupContentComponent {
  readonly graphic = input.required<Graphic>();
  readonly activeTab = input.required<PopupTab>();

  readonly title = computed<string>(() => {
    const graphic = this.graphic();
    return graphic.layer?.title ?? 'Feature';
  });
}
