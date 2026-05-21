import { inject, Injectable, signal, Signal } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import { MapViewAlreadyRegisteredError } from '../map-errors';
import { RIMA_BASEMAP_DEFAULT_ID, RIMA_SWITZERLAND_EXTENT } from '../map-constants';
import Basemap from '@arcgis/core/Basemap';
import PortalItem from '@arcgis/core/portal/PortalItem';
import { PortalService } from '../portal/portal.service';

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
    const basemap = new Basemap({
      portalItem: new PortalItem({ id: RIMA_BASEMAP_DEFAULT_ID, portal }),
    });
    await basemap.load();

    view.map.basemap = basemap;
    view.extent = RIMA_SWITZERLAND_EXTENT;
  }
}
