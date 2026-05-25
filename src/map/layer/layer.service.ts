import { inject, Injectable } from '@angular/core';
import Layer from '@arcgis/core/layers/Layer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import {
  Catalog,
  CatalogItem,
  CatalogSection,
  CatalogFeatureLayer,
  CatalogMapImageLayer,
  CatalogWebTiledLayer,
} from '../catalog/catalog-types';
import { MapViewService } from '../view/view.service';
import { LayerAddError } from './layer-errors';

@Injectable({
  providedIn: 'root',
})
export class LayerService {
  private readonly viewService = inject(MapViewService);

  addCatalogToMap(catalog: Catalog): void {
    const view = this.viewService.mapView();
    if (!view?.map) {
      throw new LayerAddError();
    }

    const layers = this.buildLayersFromItems(catalog.items);
    view.map.addMany(layers);
  }

  removeAllOperationalLayers(): void {
    const view = this.viewService.mapView();
    if (!view?.map) return;
    view.map.layers.removeAll();
  }

  private buildLayersFromItems(items: CatalogItem[]): Layer[] {
    const layers: Layer[] = [];
    for (const item of items) {
      const layer = this.buildLayer(item);
      if (layer) {
        layers.push(layer);
      }
    }
    return layers;
  }

  private buildLayer(item: CatalogItem): Layer | undefined {
    switch (item.type) {
      case 'section':
        return this.buildGroupLayer(item as CatalogSection);

      case 'feature-layer':
        return this.buildFeatureLayer(item as CatalogFeatureLayer);

      case 'map-image-layer':
        return this.buildMapImageLayer(item as CatalogMapImageLayer);

      case 'web-tiled-layer':
        return this.buildWmtsLayer(item as CatalogWebTiledLayer);

      case 'document':
        return undefined;

      default: {
        const exhaustiveCheck: never = item;
        return exhaustiveCheck;
      }
    }
  }

  private buildGroupLayer(section: CatalogSection): GroupLayer {
    const childLayers = this.buildLayersFromItems(section.items);
    return new GroupLayer({
      title: section.title,
      visible: section.visible,
      layers: childLayers,
    });
  }

  private buildFeatureLayer(catalogLayer: CatalogFeatureLayer): FeatureLayer {
    return new FeatureLayer({
      url: catalogLayer.url,
      title: catalogLayer.title,
      visible: catalogLayer.visible,
    });
  }

  private buildMapImageLayer(catalogLayer: CatalogMapImageLayer): MapImageLayer {
    return new MapImageLayer({
      url: catalogLayer.url,
      title: catalogLayer.title,
      visible: catalogLayer.visible,
    });
  }

  private buildWmtsLayer(catalogLayer: CatalogWebTiledLayer): WMTSLayer {
    return new WMTSLayer({
      url: catalogLayer.url,
      title: catalogLayer.title,
      visible: catalogLayer.visible,
      activeLayer: catalogLayer.wmtsLayerIdentifier ? { id: catalogLayer.wmtsLayerIdentifier } : undefined,
    });
  }
}
