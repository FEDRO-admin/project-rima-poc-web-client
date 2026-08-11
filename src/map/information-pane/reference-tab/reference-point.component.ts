import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  inject,
  input,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-icon';
import { ReferencePointComponentStore } from './reference-point-component.store';
import { ReferencePointComponentService } from './reference-point-component.service';
import { ReferencePointType, ReferencePoint, AttributeValue } from './reference-point-types';
import { REF_POINT_TYPE_CONFIGS } from './reference-point-config';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';
import { ViewStore } from '../../view/view.store';
import { RIMA_SWITZERLAND_EXTENT } from '../../map-constants';
import { isImmutableField } from '../../layer/layer-attributes';
import { resolveFieldDisplayValue } from '../../layer/layer-attribute-domain-resolver';

interface FieldEntry {
  label: string;
  value: AttributeValue;
}

@Component({
  selector: 'rima-reference-point',
  imports: [FormsModule, DecimalPipe, AttributeFormComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [ReferencePointComponentStore, ReferencePointComponentService],
  templateUrl: './reference-point.component.html',
  styleUrl: './reference-point.component.scss',
})
export class ReferencePointComponent implements OnDestroy {
  readonly mode = input<'edit' | 'view'>('edit');
  readonly type = input.required<ReferencePointType>();
  readonly graphic = input.required<Graphic>();
  readonly disabled = input<boolean>(false);

  protected readonly componentStore = inject(ReferencePointComponentStore);
  protected readonly viewStore = inject(ViewStore);
  private readonly service = inject(ReferencePointComponentService);

  protected readonly displayTitle = computed(() => REF_POINT_TYPE_CONFIGS[this.type()].displayTitle);
  protected readonly saving = signal(false);

  protected readonly allHighlighted = computed(() => {
    const pts = this.componentStore.points();
    const ids = this.componentStore.highlightedIds();
    return pts.length > 0 && pts.every((p) => ids.includes(p.clientId));
  });

  protected coordinateX = '';
  protected coordinateY = '';
  protected coordinateError = '';
  protected useCoordinateInput = false;

  constructor() {
    this.loadOnGraphicChange();
  }

  ngOnDestroy(): void {
    this.service.cleanup();
  }

  // --- Save ---

  protected async savePoints(): Promise<void> {
    const graphic = this.graphic();
    const parentId = graphic.attributes.id;
    const layer = graphic.layer;
    if (!parentId || !(layer instanceof FeatureLayer)) return;

    this.saving.set(true);
    try {
      await this.service.save(parentId, layer.layerId);
    } finally {
      this.saving.set(false);
    }
  }

  // --- Shared ---

  protected getPointLabel(point: ReferencePoint): string {
    const rbbs = point.attributes['rbbs'];
    if (rbbs != null && rbbs !== '') return String(rbbs);
    return 'Point';
  }

  // --- Edit mode ---

  protected startAdding(): void {
    this.coordinateX = '';
    this.coordinateY = '';
    this.coordinateError = '';
    this.useCoordinateInput = false;
    this.service.startAdding();
  }

  protected toggleCoordinateInput(): void {
    this.useCoordinateInput = !this.useCoordinateInput;
    if (this.useCoordinateInput) {
      this.coordinateError = '';
    }
  }

  protected placeOnMap(): void {
    this.service.startPlacingOnMap();
  }

  protected applyCoordinates(): void {
    const x = parseFloat(this.coordinateX);
    const y = parseFloat(this.coordinateY);
    if (isNaN(x) || isNaN(y)) {
      this.coordinateError = 'Please enter valid numbers';
      return;
    }

    const extent = RIMA_SWITZERLAND_EXTENT;
    if (x < extent.xmin || x > extent.xmax || y < extent.ymin || y > extent.ymax) {
      this.coordinateError = `Coordinates must be within Switzerland (E: ${extent.xmin}–${extent.xmax}, N: ${extent.ymin}–${extent.ymax})`;
      return;
    }

    this.coordinateError = '';
    this.service.setAddingGeometryFromCoordinates(x, y);
  }

  protected onAddingFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.componentStore.updateAddingAttribute(event.fieldName, event.value);
  }

  protected confirmAdd(): void {
    this.service.confirmAdd(this.type());
  }

  protected cancelAdd(): void {
    this.service.cancelAdd(this.type());
  }

  protected startEditing(clientId: string): void {
    this.service.startEditingPoint(clientId);
  }

  protected startEditingGeometry(clientId: string): void {
    this.service.startEditingPointGeometry(clientId, this.type());
  }

  protected onEditFieldChange(clientId: string, event: { fieldName: string; value: AttributeValue }): void {
    this.service.updatePointAttribute(clientId, event.fieldName, event.value);
  }

  protected confirmEdit(): void {
    this.service.confirmEditPoint(this.type());
  }

  protected deletePoint(clientId: string): void {
    this.service.deletePoint(clientId, this.type());
  }

  protected toggleDisplay(): void {
    this.service.toggleDisplay(this.type());
  }

  // --- View mode ---

  protected toggleHighlight(point: ReferencePoint): void {
    this.service.toggleHighlight(point, this.type());
  }

  protected toggleAllHighlights(): void {
    this.service.toggleAllHighlights(this.type());
  }

  protected isHighlighted(clientId: string): boolean {
    return this.componentStore.highlightedIds().includes(clientId);
  }

  protected getDisplayFields(point: ReferencePoint): FieldEntry[] {
    const layer = this.componentStore.relatedLayer();
    if (!layer?.fields?.length) return [];

    const graphic = new Graphic({ attributes: point.attributes, layer });
    const editableFields = layer.fields.filter((field) => !isImmutableField(field.name, layer));

    return editableFields.map((field) => ({
      label: field.alias || field.name,
      value: resolveFieldDisplayValue(graphic, field, point.attributes[field.name]),
    }));
  }

  // --- Private ---

  private loadOnGraphicChange(): void {
    effect(() => {
      const graphic = this.graphic();
      const type = this.type();
      const mode = this.mode();
      untracked(() => {
        if (mode === 'view') {
          this.service.resolveAndLoadForView(graphic, type);
        } else {
          this.service.resolveAndLoad(graphic, type);
        }
      });
    });
  }
}
