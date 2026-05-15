import { Injectable } from '@angular/core';
import esriRequest from '@arcgis/core/request';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { FEATURE_SERVER_URL } from './map-server.config';

interface FeatureServerResponse {
  layers: { id: number }[];
}

@Injectable({ providedIn: 'root' })
export class FeatureServerService {
  private readonly featureLayerCache = new Map<number, FeatureLayer>();

  async getAvailableLayerIds(): Promise<Set<number>> {
    const response = await esriRequest(FEATURE_SERVER_URL, { query: { f: 'json' } });
    const data = response.data as FeatureServerResponse;
    return new Set(data.layers.map((layer) => layer.id));
  }

  getFeatureLayer(layerId: number): FeatureLayer {
    const cached = this.featureLayerCache.get(layerId);
    if (cached) return cached;

    const featureLayer = new FeatureLayer({ url: `${FEATURE_SERVER_URL}/${layerId}` });
    this.featureLayerCache.set(layerId, featureLayer);
    return featureLayer;
  }
}
