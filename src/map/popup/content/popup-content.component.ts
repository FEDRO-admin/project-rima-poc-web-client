import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, input, signal } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import { AttributesTabComponent } from './attributes-tab/attributes-tab.component';
import { GeometryTabComponent } from './geometry-tab/geometry-tab.component';
import { HierarchyTabComponent } from './hierarchy-tab/hierarchy-tab.component';
import { DocumentsTabComponent } from './documents-tab/documents-tab.component';

export type PopupTab = 'attributes' | 'geometry' | 'hierarchy' | 'documents';

@Component({
  selector: 'rima-popup-content',
  imports: [AttributesTabComponent, GeometryTabComponent, HierarchyTabComponent, DocumentsTabComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './popup-content.component.html',
  styleUrl: './popup-content.component.scss',
})
export class PopupContentComponent {
  readonly graphic = input.required<Graphic>();

  readonly activeTab = signal<PopupTab>('attributes');

  readonly hasGeometry = computed(() => this.graphic().geometry != null);

  readonly title = computed<string>(() => {
    const graphic = this.graphic();
    return graphic.layer?.title ?? 'Feature';
  });

  selectTab(tab: PopupTab): void {
    this.activeTab.set(tab);
  }
}
