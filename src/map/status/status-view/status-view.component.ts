import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject, input, untracked } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import '@esri/calcite-components/dist/components/calcite-icon';
import { StatusService } from '../status.service';
import { StatusStore } from '../status.store';

@Component({
  selector: 'rima-status-view',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './status-view.component.html',
  styleUrl: './status-view.component.scss',
})
export class StatusViewComponent {
  readonly graphic = input.required<Graphic>();

  protected readonly store = inject(StatusStore);
  protected readonly service = inject(StatusService);

  constructor() {
    this.loadOnGraphicChange();
  }

  private loadOnGraphicChange(): void {
    effect(() => {
      const graphic = this.graphic();
      untracked(() => {
        this.service.loadForGraphic(graphic);
      });
    });
  }
}
