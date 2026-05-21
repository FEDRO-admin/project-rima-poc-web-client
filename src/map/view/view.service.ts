import { inject, Injectable, signal, Signal } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import { MapViewAlreadyRegisteredError } from '../map-errors';
import { CatalogLayer, Catalog, CatalogItem } from '../catalog/catalog-types';
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

  public addCatalogToMapView(catalog: Catalog): void {
    const view = this.mapView();
    if (!view?.map) return;

    const layers = this.collectLayers(catalog);
    for (const catalogLayer of layers) {
      switch (catalogLayer.type) {
        case 'map-image-layer': {
          view.map.add(new MapImageLayer({ url: catalogLayer.url, visible: catalogLayer.visible }));
          break;
        }
        case 'web-tiled-layer': {
          const wmtsLayer = new WMTSLayer({
            url: catalogLayer.url,
            visible: catalogLayer.visible,
            ...(catalogLayer.wmtsLayerIdentifier && {
              activeLayer: { id: catalogLayer.wmtsLayerIdentifier },
            }),
          });
          view.map.add(wmtsLayer);
          break;
        }
        case 'feature-layer': {
          view.map.add(new FeatureLayer({ url: catalogLayer.url, visible: catalogLayer.visible }));
          break;
        }
      }
    }
  }

  private collectLayers(catalog: Catalog): CatalogLayer[] {
    if (!catalog.items) return [];
    return catalog.items.flatMap((item) => this.collectLayersFromItem(item));
  }

  private collectLayersFromItem(item: CatalogItem): CatalogLayer[] {
    if (item.type === 'feature-layer' || item.type === 'map-image-layer' || item.type === 'web-tiled-layer') {
      return [item];
    }
    if (!item.items) return [];
    return item.items.flatMap((child) => this.collectLayersFromItem(child));
  }
}
