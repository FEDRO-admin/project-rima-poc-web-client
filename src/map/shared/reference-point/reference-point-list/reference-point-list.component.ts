import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import '@esri/calcite-components/dist/components/calcite-icon';
import { ReferencePointStore } from '../reference-point.store';
import { ReferencePointService } from '../reference-point.service';
import { ReferencePointType, AttributeValue } from '../reference-point-types';
import { AttributeEditField } from '../../attribute-edit-field';
import { AttributeFormComponent } from '../../attribute-form/attribute-form.component';
import { RIMA_SWITZERLAND_EXTENT } from '../../../map-constants';

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

  protected readonly points = computed(() => {
    return this.type() === 'von' ? this.store.vonPoints() : this.store.bisPoints();
  });

  protected readonly relationship = computed(() => {
    return this.type() === 'von' ? this.store.vonRelationship() : this.store.bisRelationship();
  });

  protected readonly fields = computed<AttributeEditField[]>(() => {
    const rel = this.relationship();
    return rel?.fields ?? [];
  });

  protected readonly title = computed(() => {
    return this.type() === 'von' ? 'Von Punkte' : 'Bis Punkte';
  });

  protected readonly isAddingThisType = computed(() => {
    return this.store.addingType() === this.type();
  });

  protected readonly activeEditForThisType = computed(() => {
    const edit = this.store.activeEdit();
    if (!edit || edit.type !== this.type()) return undefined;
    return edit;
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
    this.store.updateAddingAttribute(event.fieldName, event.value);
  }

  protected confirmAdd(): void {
    this.service.confirmAdd();
  }

  protected cancelAdd(): void {
    this.service.cancelAdd();
  }

  protected startEditing(index: number): void {
    this.service.startEditingPoint(this.type(), index);
  }

  protected startEditingGeometry(index: number): void {
    this.service.startEditingPointGeometry(this.type(), index);
  }

  protected onEditFieldChange(index: number, event: { fieldName: string; value: AttributeValue }): void {
    this.service.updatePointAttribute(this.type(), index, event.fieldName, event.value);
  }

  protected confirmEdit(): void {
    this.service.confirmEditPoint();
  }

  protected deletePoint(index: number): void {
    this.service.deletePoint(this.type(), index);
  }
}
