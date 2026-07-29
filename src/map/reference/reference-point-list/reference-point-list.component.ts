import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import '@esri/calcite-components/dist/components/calcite-icon';
import { VonPointStore } from '../von/von-point.store';
import { VonPointService } from '../von/von-point.service';
import { BisPointStore } from '../bis/bis-point.store';
import { BisPointService } from '../bis/bis-point.service';
import { ReferencePointType, AttributeValue } from '../reference-point-types';
import { AttributeEditField } from '../../shared/attribute-edit-field';
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

  private readonly vonStore = inject(VonPointStore);
  private readonly bisStore = inject(BisPointStore);
  private readonly vonService = inject(VonPointService);
  private readonly bisService = inject(BisPointService);

  protected readonly store = computed(() => {
    return this.type() === 'von' ? this.vonStore : this.bisStore;
  });

  private readonly service = computed(() => {
    return this.type() === 'von' ? this.vonService : this.bisService;
  });

  protected readonly points = computed(() => {
    return this.store().points();
  });

  protected readonly relationship = computed(() => {
    return this.store().relationship();
  });

  protected readonly fields = computed<AttributeEditField[]>(() => {
    const rel = this.relationship();
    return rel?.fields ?? [];
  });

  protected readonly title = computed(() => {
    return this.type() === 'von' ? 'Von Punkte' : 'Bis Punkte';
  });

  protected readonly displayVisible = computed(() => {
    return this.store().displayVisible();
  });

  protected readonly hiddenPointIds = computed(() => {
    return this.store().hiddenPointIds();
  });

  protected readonly isAddingThisType = computed(() => {
    return this.store().addingActive();
  });

  protected readonly activeEditId = computed(() => {
    return this.store().activeEditId();
  });

  protected readonly addingGeometry = computed(() => {
    return this.store().addingGeometry();
  });

  protected readonly addingAttributes = computed(() => {
    return this.store().addingAttributes();
  });

  protected readonly sketchActive = computed(() => {
    return this.store().sketchActive();
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
    this.service().startAdding();
  }

  protected toggleCoordinateInput(): void {
    this.useCoordinateInput = !this.useCoordinateInput;
    if (this.useCoordinateInput) {
      this.coordinateError = '';
    }
  }

  protected placeOnMap(): void {
    this.service().startPlacingOnMap();
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
    this.service().setAddingGeometryFromCoordinates(x, y);
  }

  protected onAddingFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.store().updateAddingAttribute(event.fieldName, event.value);
  }

  protected confirmAdd(): void {
    this.service().confirmAdd();
  }

  protected cancelAdd(): void {
    this.service().cancelAdd();
  }

  protected startEditing(clientId: string): void {
    this.service().startEditingPoint(clientId);
  }

  protected startEditingGeometry(clientId: string): void {
    this.service().startEditingPointGeometry(clientId);
  }

  protected onEditFieldChange(clientId: string, event: { fieldName: string; value: AttributeValue }): void {
    this.service().updatePointAttribute(clientId, event.fieldName, event.value);
  }

  protected confirmEdit(): void {
    this.service().confirmEditPoint();
  }

  protected deletePoint(clientId: string): void {
    this.service().deletePoint(clientId);
  }

  protected toggleDisplay(): void {
    this.service().toggleDisplay();
  }

  protected isPointHidden(clientId: string): boolean {
    return this.hiddenPointIds().includes(clientId);
  }

  protected togglePointVisibility(clientId: string): void {
    this.service().togglePointVisibility(clientId);
  }
}
