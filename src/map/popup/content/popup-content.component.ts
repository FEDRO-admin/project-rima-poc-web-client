import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, input, signal, viewChild } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { AttributesTabComponent } from './attributes-tab/attributes-tab.component';
import { HierarchyTabComponent } from './hierarchy-tab/hierarchy-tab.component';
import { DocumentsTabComponent } from './documents-tab/documents-tab.component';
import { ReferencePointComponent } from '../../reference/reference-point/reference-point.component';
import { StatusComponent } from '../../status/status.component';

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

  private readonly vonRef = viewChild<ReferencePointComponent>('vonRef');
  private readonly bisRef = viewChild<ReferencePointComponent>('bisRef');

  readonly title = computed<string>(() => {
    const graphic = this.graphic();
    return graphic.layer?.title ?? 'Feature';
  });

  private readonly vonPending = signal(false);
  private readonly bisPending = signal(false);
  readonly refPendingChanges = computed(() => this.vonPending() || this.bisPending());
  readonly refSaving = signal(false);

  onVonPendingChange(pending: boolean): void {
    this.vonPending.set(pending);
  }

  onBisPendingChange(pending: boolean): void {
    this.bisPending.set(pending);
  }

  async saveReferencePoints(): Promise<void> {
    const graphic = this.graphic();
    const parentId = graphic.attributes?.id;
    const parentLayerId = (graphic.layer as FeatureLayer)?.layerId;
    if (parentId == null || parentLayerId == null) return;

    this.refSaving.set(true);
    try {
      const von = this.vonRef();
      const bis = this.bisRef();
      await Promise.all([von?.save(parentId, parentLayerId), bis?.save(parentId, parentLayerId)]);
    } finally {
      this.refSaving.set(false);
    }
  }
}
