import { inject, Injectable, signal, Signal } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import { MapViewAlreadyRegisteredError } from '../map-errors';
import { RIMA_SWISSTOPO_WMTS_URL, RIMA_SWISSTOPO_BASEMAP_LAYER_ID, RIMA_SWITZERLAND_EXTENT } from '../map-constants';
import Basemap from '@arcgis/core/Basemap';
import PortalItem from '@arcgis/core/portal/PortalItem';
import { PortalService } from '../portal/portal.service';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';

@Injectable({
  providedIn: 'root',
})
export class MapViewService {
  public readonly mapView: Signal<MapView | undefined>;
  private readonly writableMapView = signal<MapView | undefined>(undefined);
  private readonly portalService = inject(PortalService);

  constructor() {
    this.mapView = this.writableMapView.asReadonly();
  }

  public async registerMapView(mapView: MapView): Promise<void> {
    if (this.mapView()) throw new MapViewAlreadyRegisteredError();
    this.writableMapView.set(mapView);
  }

  public async addBasemap(): Promise<void> {
    const view = this.mapView();
    if (!view) throw new Error('Map view not registered');
    if (!view.map) throw new Error('Map view has no map');

    const portal = await this.portalService.getPortal();

    const swisstopoLayer = new WMTSLayer({
      url: RIMA_SWISSTOPO_WMTS_URL,
      activeLayer: { id: RIMA_SWISSTOPO_BASEMAP_LAYER_ID },
    });

    view.map.basemap = new Basemap({
      baseLayers: [swisstopoLayer],
      title: 'Swisstopo Pixelkarte',
      id: 'swisstopo',
    });

    view.extent = RIMA_SWITZERLAND_EXTENT;
  }
}
