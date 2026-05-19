import { inject, Injectable, signal, Signal } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import { MapViewAlreadyRegisteredError } from '../map.error';
import { WebmapService } from '../webmap/webmap.service';

@Injectable({
  providedIn: 'root',
})
export class MapViewService {
  public readonly mapView: Signal<MapView | undefined>;
  private readonly writableMapView = signal<MapView | undefined>(undefined);
  private readonly webMapService = inject(WebmapService);

  constructor() {
    this.mapView = this.writableMapView.asReadonly();
  }

  public async registerMapView(mapView: MapView): Promise<void> {
    if (this.mapView()) throw new MapViewAlreadyRegisteredError();
    await this.webMapService.loadWebMap();
    mapView.map = this.webMapService.webMap()!;
    this.writableMapView.set(mapView);
  }
}
