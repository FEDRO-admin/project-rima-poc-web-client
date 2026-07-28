import { Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import WMSLayer from '@arcgis/core/layers/WMSLayer';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import Layer from '@arcgis/core/layers/Layer';
import { RIMA_SWITZERLAND_EXTENT } from '../map-constants';
import {
  LAYER_TYPE_FEATURE,
  LAYER_TYPE_GROUP,
  LAYER_TYPE_WMS,
  LAYER_TYPE_WEB_TILED,
  type WebmapDataJson,
  type GroupLayerJson,
  type WebmapOperationalLayerJson,
  type WebTiledLayerJson,
} from './layer-types';

@Injectable({
  providedIn: 'root',
})
export class LayerService {
  parseWebmapJsonToLayers(data: WebmapDataJson): Layer[] {
    return this.parseOperationalLayers(data.operationalLayers ?? []);
  }

  private parseOperationalLayers(entries: WebmapOperationalLayerJson[]): Layer[] {
    const result: Layer[] = [];

    for (const entry of entries) {
      const layer = this.parseLayer(entry);
      if (layer) {
        result.push(layer);
      }
    }

    return result;
  }

  private parseLayer(entry: WebmapOperationalLayerJson): Layer | undefined {
    switch (entry.layerType) {
      case LAYER_TYPE_FEATURE:
        return this.createFeatureLayer(entry);
      case LAYER_TYPE_GROUP:
        return this.createGroupLayer(entry as GroupLayerJson);
      case LAYER_TYPE_WMS:
        return this.createWmsLayer(entry);
      case LAYER_TYPE_WEB_TILED:
        return this.createWmtsLayer(entry as WebTiledLayerJson);
      default:
        return undefined;
    }
  }

  private createFeatureLayer(entry: WebmapOperationalLayerJson): FeatureLayer | undefined {
    if (!entry.url) return undefined;

    return new FeatureLayer({
      url: entry.url,
      title: entry.title,
      visible: entry.visibility ?? true,
      fullExtent: RIMA_SWITZERLAND_EXTENT,
      outFields: ['*'],
    });
  }

  private createGroupLayer(entry: GroupLayerJson): GroupLayer | undefined {
    const children = this.parseOperationalLayers(entry.layers ?? []);
    if (children.length === 0) return undefined;

    return new GroupLayer({
      title: entry.title ?? '',
      layers: children,
      visible: entry.visibility ?? true,
    });
  }

  private createWmsLayer(entry: WebmapOperationalLayerJson): WMSLayer | undefined {
    if (!entry.url) return undefined;

    return new WMSLayer({
      url: entry.url,
      title: entry.title,
      visible: entry.visibility ?? true,
    });
  }

  private createWmtsLayer(entry: WebTiledLayerJson): WMTSLayer | undefined {
    const wmtsInfo = entry.wmtsInfo;
    if (!wmtsInfo?.url) return undefined;

    return new WMTSLayer({
      url: wmtsInfo.url,
      activeLayer: wmtsInfo.layerIdentifier ? { id: wmtsInfo.layerIdentifier } : undefined,
      title: entry.title,
      visible: entry.visibility ?? true,
    });
  }
}
