import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { GeometryEditService } from '../../../edit/geometry/geometry-edit.service';
import { GeometryEditStore } from '../../../edit/geometry/geometry-edit.store';
import { GeometryEditFormComponent } from '../../../edit/geometry/geometry-edit-form/geometry-edit-form.component';
import '@esri/calcite-components/dist/components/calcite-icon';

type AttributeValue = string | number | boolean | null;

interface GeometryInfo {
  label: string;
  value: string;
}

@Component({
  selector: 'rima-geometry-tab',
  imports: [GeometryEditFormComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './geometry-tab.component.html',
  styleUrl: './geometry-tab.component.scss',
})
export class GeometryTabComponent {
  readonly graphic = input.required<Graphic>();

  protected readonly geometryEditStore = inject(GeometryEditStore);
  private readonly geometryEditService = inject(GeometryEditService);

  protected readonly supportsGeometryUpdate = computed(() => {
    const graphic = this.graphic();
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return false;
    return layer.capabilities?.editing?.supportsGeometryUpdate ?? false;
  });

  protected readonly geometryInfo = computed<GeometryInfo[]>(() => {
    const graphic = this.graphic();
    const info: GeometryInfo[] = [];
    const geometry = graphic.geometry;

    if (geometry) {
      info.push({ label: 'Geometry Type', value: geometry.type });
    }

    const attrs: Record<string, AttributeValue> = graphic.attributes ?? {};
    const lengthKeys = ['st_length(shape)', 'shape_length', 'shape__length'];
    const areaKeys = ['st_area(shape)', 'shape_area', 'shape__area'];

    for (const key of Object.keys(attrs)) {
      const lower = key.toLowerCase();
      if (lengthKeys.includes(lower) && attrs[key] != null) {
        info.push({ label: 'Length', value: this.formatNumber(attrs[key]) });
      }
      if (areaKeys.includes(lower) && attrs[key] != null) {
        info.push({ label: 'Area', value: this.formatNumber(attrs[key]) });
      }
    }

    return info;
  });

  protected startEditing(): void {
    this.geometryEditService.startEditing(this.graphic());
  }

  private formatNumber(value: AttributeValue): string {
    if (typeof value === 'number') {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return String(value);
  }
}
