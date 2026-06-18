import { Component, CUSTOM_ELEMENTS_SCHEMA, DestroyRef, inject, input } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import { GeometryEditService } from '../geometry-edit.service';
import { GeometryEditStore } from '../geometry-edit.store';
import '@esri/calcite-components/dist/components/calcite-icon';

@Component({
  selector: 'rima-geometry-edit-form',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './geometry-edit-form.component.html',
  styleUrl: './geometry-edit-form.component.scss',
})
export class GeometryEditFormComponent {
  readonly graphic = input.required<Graphic>();

  protected readonly store = inject(GeometryEditStore);
  private readonly geometryEditService = inject(GeometryEditService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.destroyRef.onDestroy(() => this.geometryEditService.cancel());
  }

  protected startEditing(): void {
    this.geometryEditService.startEditing(this.graphic());
  }

  protected reenterSketch(): void {
    this.geometryEditService.reenterSketch();
  }

  protected undo(): void {
    this.geometryEditService.undo();
  }

  protected redo(): void {
    this.geometryEditService.redo();
  }

  protected async save(): Promise<void> {
    await this.geometryEditService.save();
  }

  protected cancel(): void {
    this.geometryEditService.cancel();
  }
}
