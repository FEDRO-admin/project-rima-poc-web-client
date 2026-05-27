import { Component, computed, input, signal } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

export type PopupTab = 'attributes' | 'hierarchy' | 'documents';

interface FieldEntry {
  label: string;
  value: unknown;
}

@Component({
  selector: 'rima-popup-content',
  templateUrl: './popup-content.component.html',
  styleUrl: './popup-content.component.scss',
})
export class PopupContentComponent {
  readonly graphic = input.required<Graphic>();

  readonly activeTab = signal<PopupTab>('attributes');

  readonly title = computed<string>(() => {
    const graphic = this.graphic();
    return graphic.layer?.title ?? 'Feature';
  });

  readonly fields = computed<FieldEntry[]>(() => {
    const graphic = this.graphic();
    const layer = graphic.layer;
    const attrs = graphic.attributes ?? {};

    if (layer instanceof FeatureLayer && layer.fields?.length) {
      return layer.fields
        .filter((field) => attrs[field.name] != null)
        .map((field) => ({ label: field.alias || field.name, value: attrs[field.name] }));
    }

    return Object.entries(attrs).map(([key, value]) => ({ label: key, value }));
  });

  selectTab(tab: PopupTab): void {
    this.activeTab.set(tab);
  }
}
