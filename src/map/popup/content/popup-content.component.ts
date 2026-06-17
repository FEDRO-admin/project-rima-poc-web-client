import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input, signal } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Field from '@arcgis/core/layers/support/Field';
import type CodedValueDomain from '@arcgis/core/layers/support/CodedValueDomain';
import { GraphicLayer } from '@arcgis/core/Graphic';
import { EditFormComponent } from '../../edit/edit-form/edit-form.component';
import { EditStore } from '../../edit/edit.store';
import { isLayerEditable, isSystemField } from '../../edit/edit-capability';
import '@esri/calcite-components/dist/components/calcite-icon';

export type PopupTab = 'attributes' | 'hierarchy' | 'documents';

type AttributeValue = string | number | boolean | null;

interface FieldEntry {
  label: string;
  value: AttributeValue;
}

@Component({
  selector: 'rima-popup-content',
  imports: [EditFormComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './popup-content.component.html',
  styleUrl: './popup-content.component.scss',
})
export class PopupContentComponent {
  readonly graphic = input.required<Graphic>();

  private readonly editStore = inject(EditStore);

  readonly activeTab = signal<PopupTab>('attributes');
  readonly editMode = computed(() => this.editStore.editing());

  readonly isEditable = computed(() => isLayerEditable(this.graphic()));

  readonly title = computed<string>(() => {
    const graphic = this.graphic();
    return graphic.layer?.title ?? 'Feature';
  });

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
        .filter((field) => isSystemField(field.name) && attrs[field.name] != null)
        .map((field) => ({
          label: field.alias || field.name,
          value: this.resolveFieldValue(field, attrs[field.name], layer),
        }));
    }

    return [];
  });

  selectTab(tab: PopupTab): void {
    this.activeTab.set(tab);
  }

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
