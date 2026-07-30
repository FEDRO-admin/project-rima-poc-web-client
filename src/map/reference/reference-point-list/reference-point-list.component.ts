import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import '@esri/calcite-components/dist/components/calcite-icon';
import { ReferencePointStore } from '../reference-point.store';
import { ReferencePointService } from '../reference-point.service';
import { ReferencePointType, AttributeValue } from '../reference-point-types';
import { REF_POINT_TYPE_CONFIGS } from '../reference-point-config';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';
import { RIMA_SWITZERLAND_EXTENT } from '../../map-constants';

@Component({
  selector: 'rima-reference-point-list',
  imports: [FormsModule, DecimalPipe, AttributeFormComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './reference-point-list.component.html',
  styleUrl: './reference-point-list.component.scss',
})
export class ReferencePointListComponent {
  readonly type = input.required<ReferencePointType>();
  readonly disabled = input<boolean>(false);

  protected readonly store = inject(ReferencePointStore);
  private readonly service = inject(ReferencePointService);

  protected readonly typeStore = computed(() => this.store.forType(this.type()));

  protected readonly displayTitle = computed(() => REF_POINT_TYPE_CONFIGS[this.type()].displayTitle);

  protected readonly activeEditId = computed(() => {
    return this.store.editingType() === this.type() ? this.store.activeEditId() : undefined;
  });

  protected readonly isAdding = computed(() => {
    return this.store.addingType() === this.type();
  });

  protected coordinateX = '';
  protected coordinateY = '';
  protected coordinateError = '';
  protected useCoordinateInput = false;

  protected getPointLabel(point: { attributes: Record<string, AttributeValue> }): string {
    const rbbs = point.attributes['rbbs'];
    if (rbbs != null && rbbs !== '') return String(rbbs);
    return 'Point';
  }

  protected startAdding(): void {
    this.coordinateX = '';
    this.coordinateY = '';
    this.coordinateError = '';
    this.useCoordinateInput = false;
    this.service.startAdding(this.type());
  }

  protected toggleCoordinateInput(): void {
    this.useCoordinateInput = !this.useCoordinateInput;
    if (this.useCoordinateInput) {
      this.coordinateError = '';
    }
  }

  protected placeOnMap(): void {
    this.service.startPlacingOnMap(this.type());
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
    this.store.addingAttributes.update((attrs) => ({ ...attrs, [event.fieldName]: event.value }));
  }

  protected confirmAdd(): void {
    this.service.confirmAdd(this.type());
  }

  protected cancelAdd(): void {
    this.service.cancelAdd();
  }

  protected startEditing(clientId: string): void {
    this.service.startEditingPoint(this.type(), clientId);
  }

  protected startEditingGeometry(clientId: string): void {
    this.service.startEditingPointGeometry(this.type(), clientId);
  }

  protected onEditFieldChange(clientId: string, event: { fieldName: string; value: AttributeValue }): void {
    this.service.updatePointAttribute(this.type(), clientId, event.fieldName, event.value);
  }

  protected confirmEdit(): void {
    this.service.confirmEditPoint(this.type());
  }

  protected deletePoint(clientId: string): void {
    this.service.deletePoint(this.type(), clientId);
  }

  protected toggleDisplay(): void {
    this.service.toggleDisplay(this.type());
  }

  protected isPointHidden(clientId: string): boolean {
    return this.typeStore().hiddenPointIds().includes(clientId);
  }

  protected togglePointVisibility(clientId: string): void {
    this.service.togglePointVisibility(this.type(), clientId);
  }
}
