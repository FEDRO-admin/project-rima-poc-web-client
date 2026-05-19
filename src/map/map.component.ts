import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import { MapViewService } from './mapview/mapview.service';

@Component({
  selector: 'rima-map',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly mapViewService = inject(MapViewService);

  protected async onViewReady(event: Event): Promise<void> {
    const mapElement = event.target as HTMLArcgisMapElement;
    await this.mapViewService.registerMapView(mapElement.view);
  }
}
