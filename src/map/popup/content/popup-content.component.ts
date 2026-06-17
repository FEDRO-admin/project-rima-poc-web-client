import { Component, computed, input, signal } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Field from '@arcgis/core/layers/support/Field';
import type CodedValueDomain from '@arcgis/core/layers/support/CodedValueDomain';
import { GraphicLayer } from '@arcgis/core/Graphic';

export type PopupTab = 'attributes' | 'hierarchy' | 'documents';

type AttributeValue = string | number | boolean | null;

interface FieldEntry {
  label: string;
  value: AttributeValue;
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
    const graphic: Graphic = this.graphic();
    const layer: GraphicLayer | null | undefined = graphic.layer;
    const attrs: Record<string, AttributeValue> = graphic.attributes ?? {};

    if (layer instanceof FeatureLayer && layer.fields?.length) {
      return layer.fields.map((field) => ({
        label: field.alias || field.name,
        value: this.resolveFieldValue(field, attrs[field.name], layer),
      }));
    }

    return Object.entries(attrs).map(([key, value]) => ({ label: key, value }));
  });

  selectTab(tab: PopupTab): void {
    this.activeTab.set(tab);
  }

  private resolveFieldValue(field: Field, value: AttributeValue | undefined, layer: FeatureLayer): AttributeValue {
    if (value == null) {
      return null;
    }

    if (field.name === layer.typeIdField && layer.types?.length) {
      const match = layer.types.find((t) => t.id === value);
      if (match) {
        return match.name;
      }
    }

    if (this.isCodedValueDomain(field.domain)) {
      const match = field.domain.codedValues?.find((cv) => cv.code === value);
      if (match) {
        return match.name;
      }
    }

    return value;
  }

  private isCodedValueDomain(domain: Field['domain']): domain is CodedValueDomain {
    return domain?.type === 'coded-value';
  }
}
