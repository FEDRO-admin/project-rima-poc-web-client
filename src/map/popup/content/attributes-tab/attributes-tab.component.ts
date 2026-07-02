import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { GraphicLayer } from '@arcgis/core/Graphic';
import '@esri/calcite-components/dist/components/calcite-icon';
import { isImmutableField } from '../../../layer/layer-attributes';
import { resolveFieldDisplayValue } from '../../../layer/layer-attribute-domain-resolver';

type AttributeValue = string | number | boolean | null;

interface FieldEntry {
  label: string;
  value: AttributeValue;
}

@Component({
  selector: 'rima-attributes-tab',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './attributes-tab.component.html',
  styleUrl: './attributes-tab.component.scss',
})
export class AttributesTabComponent {
  readonly graphic = input.required<Graphic>();

  readonly fields = computed<FieldEntry[]>(() => {
    const graphic: Graphic = this.graphic();
    const layer: GraphicLayer | null | undefined = graphic.layer;
    const attrs: Record<string, AttributeValue> = graphic.attributes ?? {};

    if (layer instanceof FeatureLayer && layer.fields?.length) {
      return layer.fields
        .filter((field) => !isImmutableField(field.name, layer))
        .map((field) => ({
          label: field.alias || field.name,
          value: resolveFieldDisplayValue(graphic, field, attrs[field.name]),
        }));
    }

    return Object.entries(attrs).map(([key, value]) => ({ label: key, value }));
  });

  readonly immutableFields = computed<FieldEntry[]>(() => {
    const graphic: Graphic = this.graphic();
    const layer: GraphicLayer | null | undefined = graphic.layer;
    const attrs: Record<string, AttributeValue> = graphic.attributes ?? {};

    if (layer instanceof FeatureLayer && layer.fields?.length) {
      return layer.fields
        .filter((field) => isImmutableField(field.name, layer))
        .map((field) => ({
          label: field.alias || field.name,
          value: resolveFieldDisplayValue(graphic, field, attrs[field.name]),
        }));
    }

    return [];
  });
}
