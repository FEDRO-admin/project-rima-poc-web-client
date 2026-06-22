import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Field from '@arcgis/core/layers/support/Field';
import type CodedValueDomain from '@arcgis/core/layers/support/CodedValueDomain';
import { GraphicLayer } from '@arcgis/core/Graphic';
import { AttributeEditFormComponent } from '../../../edit/attributes/attribute-edit-form/attribute-edit-form.component';
import { AttributeEditStore } from '../../../edit/attributes/attribute-edit.store';
import { isLayerEditable, isSystemField } from '../../../edit/edit-capability';
import '@esri/calcite-components/dist/components/calcite-icon';

type AttributeValue = string | number | boolean | null;

interface FieldEntry {
  label: string;
  value: AttributeValue;
}

@Component({
  selector: 'rima-attributes-tab',
  imports: [AttributeEditFormComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './attributes-tab.component.html',
  styleUrl: './attributes-tab.component.scss',
})
export class AttributesTabComponent {
  readonly graphic = input.required<Graphic>();

  private readonly editStore = inject(AttributeEditStore);

  readonly editMode = computed(() => this.editStore.editing());
  readonly isEditable = computed(() => isLayerEditable(this.graphic()));

  readonly fields = computed<FieldEntry[]>(() => {
    const graphic: Graphic = this.graphic();
    const layer: GraphicLayer | null | undefined = graphic.layer;
    const attrs: Record<string, AttributeValue> = graphic.attributes ?? {};

    if (layer instanceof FeatureLayer && layer.fields?.length) {
      return layer.fields
        .filter((field) => !isSystemField(field.name))
        .map((field) => ({
          label: field.alias || field.name,
          value: this.resolveFieldValue(field, attrs[field.name], layer),
        }));
    }

    return Object.entries(attrs).map(([key, value]) => ({ label: key, value }));
  });

  readonly systemFields = computed<FieldEntry[]>(() => {
    const graphic: Graphic = this.graphic();
    const layer: GraphicLayer | null | undefined = graphic.layer;
    const attrs: Record<string, AttributeValue> = graphic.attributes ?? {};

    if (layer instanceof FeatureLayer && layer.fields?.length) {
      return layer.fields
        .filter((field) => isSystemField(field.name))
        .map((field) => ({
          label: field.alias || field.name,
          value: this.resolveFieldValue(field, attrs[field.name], layer),
        }));
    }

    return [];
  });

  startEdit(): void {
    this.editStore.startEditing(this.graphic());
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
