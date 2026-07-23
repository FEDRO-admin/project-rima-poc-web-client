import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { GraphicLayer } from '@arcgis/core/Graphic';
import '@esri/calcite-components/dist/components/calcite-icon';
import { isImmutableField } from '../../../layer/layer-attributes';
import { resolveFieldDisplayValue } from '../../../layer/layer-attribute-domain-resolver';
import { PopupReferencePointStore } from '../../reference-point/popup-reference-point.store';
import { PopupReferencePointService } from '../../reference-point/popup-reference-point.service';
import { PopupStore } from '../../popup.store';
import type { ReferencePoint, ReferencePointType } from '../../../reference/reference-point-types';

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

  protected readonly refPointStore = inject(PopupReferencePointStore);
  private readonly refPointService = inject(PopupReferencePointService);
  private readonly popupStore = inject(PopupStore);

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

  protected getPointLabel(point: ReferencePoint): string {
    const rbbs = point.attributes['rbbs'];
    if (rbbs != null && rbbs !== '') return String(rbbs);
    return 'Point';
  }

  protected toggleRefPoints(): void {
    if (this.refPointStore.visible()) {
      this.refPointService.hide();
    } else {
      this.refPointService.showOnMap();
    }
  }

  protected openRefPoint(point: ReferencePoint, type: ReferencePointType): void {
    const rel = this.refPointStore[type]().relationship;
    if (!rel?.relatedLayer) return;

    const graphic = new Graphic({
      attributes: { ...point.attributes },
      geometry: point.geometry ?? undefined,
    });
    graphic.layer = rel.relatedLayer;
    this.popupStore.open([graphic]);
  }
}
