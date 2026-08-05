import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  untracked,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-icon';
import { ReferencePointComponentStore } from '../reference-point-component.store';
import { ReferencePointComponentService } from '../reference-point-component.service';
import { ViewStore } from '../../view/view.store';
import { ReferencePointType, ReferencePoint, AttributeValue } from '../reference-point-types';
import { REF_POINT_TYPE_CONFIGS } from '../reference-point-config';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';
import { resolveFieldDisplayValue } from '../../layer/layer-attribute-domain-resolver';
import { isImmutableField } from '../../layer/layer-attributes';
import { RIMA_SWITZERLAND_EXTENT } from '../../map-constants';

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
  readonly mode = input.required<'edit' | 'view'>();
  readonly type = input.required<ReferencePointType>();
  readonly graphic = input<Graphic>();
  readonly layer = input<FeatureLayer>();
  readonly disabled = input<boolean>(false);

  readonly pendingChangesChange = output<boolean>();

  protected readonly componentStore = inject(ReferencePointComponentStore);
  protected readonly viewStore = inject(ViewStore);
  private readonly service = inject(ReferencePointComponentService);

  protected readonly displayTitle = computed(() => REF_POINT_TYPE_CONFIGS[this.type()].displayTitle);

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
    this.loadOnInputChange();
    this.emitPendingChanges();
  }

  ngOnDestroy(): void {
    this.service.cleanup();
  }

  async save(parentId: string, parentLayerId: number): Promise<void> {
    await this.service.save(parentId, parentLayerId);
  }

  // --- Edit mode methods ---

  protected getPointLabel(point: ReferencePoint): string {
    const rbbs = point.attributes['rbbs'];
    if (rbbs != null && rbbs !== '') return String(rbbs);
    return 'Point';
  }

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

  // --- View mode methods ---

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

  private loadOnInputChange(): void {
    effect(() => {
      const graphic = this.graphic();
      const layer = this.layer();
      const type = this.type();
      const mode = this.mode();
      untracked(() => {
        if (mode === 'edit' && graphic) {
          this.service.resolveAndLoad(graphic, type);
        } else if (mode === 'edit' && layer) {
          this.service.resolveForCreate(layer, type);
        } else if (mode === 'view' && graphic) {
          this.service.resolveAndLoadForView(graphic, type);
        }
      });
    });
  }

  private emitPendingChanges(): void {
    effect(() => {
      const pending = this.componentStore.hasPendingChanges();
      untracked(() => {
        this.pendingChangesChange.emit(pending);
      });
    });
  }
}
