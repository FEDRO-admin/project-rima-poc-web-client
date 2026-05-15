import { Injectable } from '@angular/core';
import esriRequest from '@arcgis/core/request';
import { MAP_SERVER_URL } from './map-server.config';
import type { LayerTreeNode } from './layer-tree';

interface MapServerLayerEntry {
  id: number;
  name: string;
  type: string;
  parentLayerId: number;
  subLayerIds: number[] | null;
  defaultVisibility: boolean;
  geometryType?: string;
}

interface MapServerResponse {
  layers: MapServerLayerEntry[];
}

@Injectable({ providedIn: 'root' })
export class MapServerService {
  async getLayerTree(): Promise<LayerTreeNode[]> {
    const response = await esriRequest(MAP_SERVER_URL, { query: { f: 'json' } });
    const { layers } = response.data as MapServerResponse;

    const rootLayer = layers.find((layer) => layer.parentLayerId === -1);
    if (!rootLayer) return [];

    return this.buildChildren(rootLayer.id, layers);
  }

  private buildChildren(parentId: number, allLayers: MapServerLayerEntry[]): LayerTreeNode[] {
    const children = allLayers.filter((layer) => layer.parentLayerId === parentId);

    return children.map((layer) => {
      if (layer.type === 'Feature Layer') {
        return {
          id: layer.id,
          name: layer.name,
          type: 'feature' as const,
          visible: layer.defaultVisibility,
          geometryType: layer.geometryType ?? '',
          hasFeatureServer: false,
        };
      }

      return {
        id: layer.id,
        name: layer.name,
        type: 'group' as const,
        visible: layer.defaultVisibility,
        children: this.buildChildren(layer.id, allLayers),
      };
    });
  }
}
