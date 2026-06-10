import { Injectable, signal, Signal } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import { MapViewAlreadyRegisteredError } from '../map-errors';
import { RIMA_SWISSTOPO_WMTS_URL, RIMA_SWISSTOPO_BASEMAP_LAYER_ID } from '../map-constants';
import Basemap from '@arcgis/core/Basemap';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';

@Injectable({
  providedIn: 'root',
})
export class MapViewService {
  public readonly mapView: Signal<MapView | undefined>;
  private readonly writableMapView = signal<MapView | undefined>(undefined);

  constructor() {
    this.mapView = this.writableMapView.asReadonly();
  }

  public async registerMapView(mapView: MapView): Promise<void> {
    if (this.mapView()) throw new MapViewAlreadyRegisteredError();
    this.writableMapView.set(mapView);
  }

  public addBasemap(): void {
    const view = this.mapView();
    if (!view) throw new Error('Map view not registered');
    if (!view.map) throw new Error('Map view has no map');

    const swisstopoLayer = new WMTSLayer({
      url: RIMA_SWISSTOPO_WMTS_URL,
      activeLayer: { id: RIMA_SWISSTOPO_BASEMAP_LAYER_ID },
    });

    view.map.basemap = new Basemap({
      baseLayers: [swisstopoLayer],
      title: 'Swisstopo Pixelkarte',
      id: 'swisstopo',
    });
  }
}
