import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, viewChild } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import { LayersStore } from '../stores/layers.store';

@Component({
  selector: 'rima-map',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly layersStore = inject(LayersStore);

  protected readonly mapElement = viewChild<ElementRef<HTMLArcgisMapElement>>('arcgisMap');

  constructor() {
    effect(() => {
      const isLoaded = this.layersStore.isLoaded();
      const mapRef = this.mapElement();
      if (!isLoaded || !mapRef?.nativeElement) return;

      const webMap = this.layersStore.getWebMap();
      if (!webMap) return;

      mapRef.nativeElement.map = webMap;
    });
  }
}
