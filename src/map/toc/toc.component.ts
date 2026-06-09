import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, untracked, viewChild } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-layer-list';
import { MapViewService } from '../view/view.service';

@Component({
  selector: 'rima-toc',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './toc.component.html',
  styleUrl: './toc.component.scss',
})
export class TocComponent {
  private readonly viewService = inject(MapViewService);
  private readonly layerListElement = viewChild<ElementRef<HTMLArcgisLayerListElement>>('layerList');

  constructor() {
    effect(() => {
      const view = this.viewService.mapView();
      untracked(() => {
        const layerList = this.layerListElement()?.nativeElement;
        if (view && layerList) {
          layerList.view = view;
        }
      });
    });
  }
}
