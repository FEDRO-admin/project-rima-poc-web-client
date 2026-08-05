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

  readonly activeTab = signal<PopupTab>('attributes');
  readonly refPendingChanges = signal(false);
  readonly refSaving = signal(false);
  private vonPending = false;
  private bisPending = false;

  private readonly vonRef = viewChild<ReferencePointComponent>('vonRef');
  private readonly bisRef = viewChild<ReferencePointComponent>('bisRef');

  readonly title = computed<string>(() => {
    const graphic = this.graphic();
    return graphic.layer?.title ?? 'Feature';
  });

  selectTab(tab: PopupTab): void {
    this.activeTab.set(tab);
  }

  protected onVonPendingChange(pending: boolean): void {
    this.vonPending = pending;
    this.refPendingChanges.set(this.vonPending || this.bisPending);
  }

  protected onBisPendingChange(pending: boolean): void {
    this.bisPending = pending;
    this.refPendingChanges.set(this.vonPending || this.bisPending);
  }

  protected async saveReferencePoints(): Promise<void> {
    const graphic = this.graphic();
    const parentId = graphic.attributes.id;
    const layer = graphic.layer;
    if (!parentId || !(layer instanceof FeatureLayer)) return;

    this.refSaving.set(true);
    try {
      await this.vonRef()?.save(parentId, layer.layerId);
      await this.bisRef()?.save(parentId, layer.layerId);
    } finally {
      this.refSaving.set(false);
    }
  }
}
