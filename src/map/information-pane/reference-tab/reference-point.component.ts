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
import { ReferencePoint, AttributeValue } from './reference-point-types';
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
  readonly graphic = input.required<Graphic>();
  readonly disabled = input<boolean>(false);

  protected readonly componentStore = inject(ReferencePointComponentStore);
  protected readonly viewStore = inject(ViewStore);
  private readonly service = inject(ReferencePointComponentService);

  protected readonly saving = signal(false);
  protected readonly addCardinalityError = signal('');
  protected readonly editCardinalityError = signal('');

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
      await this.service.save(parentId, layer);
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

  protected getPointTypeBadge(point: ReferencePoint): string {
    if (point.type === 'von') return 'Von';
    if (point.type === 'bis') return 'Bis';
    return '';
  }

  // --- Edit mode ---

  protected startAdding(): void {
    this.coordinateX = '';
    this.coordinateY = '';
    this.coordinateError = '';
    this.addCardinalityError.set('');
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
    this.addCardinalityError.set('');
    this.componentStore.updateAddingAttribute(event.fieldName, event.value);
  }

  protected confirmAdd(): void {
    const success = this.service.confirmAdd();
    if (!success) {
      this.addCardinalityError.set('A reference point of this type already exists for this feature.');
    }
  }

  protected cancelAdd(): void {
    this.addCardinalityError.set('');
    this.service.cancelAdd();
  }

  protected startEditing(clientId: string): void {
    this.editCardinalityError.set('');
    this.service.startEditingPoint(clientId);
  }

  protected startEditingGeometry(clientId: string): void {
    this.service.startEditingPointGeometry(clientId);
  }

  protected onEditFieldChange(clientId: string, event: { fieldName: string; value: AttributeValue }): void {
    const success = this.service.updatePointAttribute(clientId, event.fieldName, event.value);
    if (!success) {
      this.editCardinalityError.set('A reference point of this type already exists for this feature.');
    } else {
      this.editCardinalityError.set('');
    }
  }

  protected confirmEdit(): void {
    this.service.confirmEditPoint();
  }

  protected deletePoint(clientId: string): void {
    this.service.deletePoint(clientId);
  }

  protected toggleDisplay(): void {
    this.service.toggleDisplay();
  }

  // --- View mode ---

  protected toggleHighlight(point: ReferencePoint): void {
    this.service.toggleHighlight(point);
  }

  protected toggleAllHighlights(): void {
    this.service.toggleAllHighlights();
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
      const mode = this.mode();
      untracked(() => {
        if (mode === 'view') {
          this.service.resolveAndLoadForView(graphic);
        } else {
          this.service.resolveAndLoad(graphic);
        }
      });
    });
  }
}
