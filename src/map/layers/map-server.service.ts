import { Injectable } from '@angular/core';
import esriRequest from '@arcgis/core/request';
import { MAP_SERVER_URL } from './map-server.config';

interface MapServerLayerEntry {
  id: number;
  name: string;
  type: string;
  parentLayerId: number;
  subLayerIds: number[] | null;
  defaultVisibility: boolean;
}

interface MapServerResponse {
  layers: MapServerLayerEntry[];
}

export interface LanguageGroups {
  de: number[];
  fr: number[];
  it: number[];
}

@Injectable({ providedIn: 'root' })
export class MapServerService {
  async getLanguageGroups(): Promise<LanguageGroups> {
    const response = await esriRequest(MAP_SERVER_URL, { query: { f: 'json' } });
    const { layers } = response.data as MapServerResponse;

    return {
      de: this.collectFeatureLayerIds('DE', layers),
      fr: this.collectFeatureLayerIds('FR', layers),
      it: this.collectFeatureLayerIds('IT', layers),
    };
  }

  private collectFeatureLayerIds(groupName: string, allLayers: MapServerLayerEntry[]): number[] {
    const layerById = new Map(allLayers.map((layer) => [layer.id, layer]));
    const groupLayer = allLayers.find(
      (layer) => layer.name.toUpperCase() === groupName && layer.type === 'Group Layer',
    );

    if (!groupLayer) return [];

    const featureLayerIds: number[] = [];

    const collectRecursively = (layer: MapServerLayerEntry): void => {
      if (layer.type === 'Feature Layer') {
        featureLayerIds.push(layer.id);
      } else {
        layer.subLayerIds?.forEach((childId) => {
          const child = layerById.get(childId);
          if (child) collectRecursively(child);
        });
      }
    };

    collectRecursively(groupLayer);
    return featureLayerIds;
  }
}
