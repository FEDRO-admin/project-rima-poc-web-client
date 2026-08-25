import { inject, Injectable } from '@angular/core';
import esriRequest from '@arcgis/core/request';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Layer from '@arcgis/core/layers/Layer';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import type ArcGISMap from '@arcgis/core/Map';
import { PortalService } from '../portal/portal.service';
import { LayerNameNotFoundError, LayerIdNotFoundError, LayerNameCollisionError } from './layer-errors';
import type { FeatureServerMetadataJson } from './layer-types';

@Injectable({
  providedIn: 'root',
})
export class LayerIdResolver {
  private readonly portalService = inject(PortalService);
  private readonly nameToId = new Map<string, number>();
  private readonly idToName = new Map<number, string>();
  private readonly fetchedServiceUrls = new Set<string>();

  async loadFromPortalCategory(category: string): Promise<void> {
    const query = new PortalQueryParams({
      categories: [`/Categories/${category}`],
      query: 'type:"Feature Service"',
      num: 100,
    });

    const items = await this.portalService.queryItems(query);

    await Promise.all(
      items.map(async (item) => {
        if (!item.url) return;
        await this.registerFromServiceUrl(item.url);
      }),
    );
  }

  resolveId(layerName: string): number {
    const id = this.nameToId.get(layerName);
    if (id === undefined) {
      throw new LayerNameNotFoundError(layerName);
    }
    return id;
  }

  resolveName(layerId: number): string {
    const name = this.idToName.get(layerId);
    if (name === undefined) {
      throw new LayerIdNotFoundError(layerId);
    }
    return name;
  }

  async resolveIdAsync(layerName: string, map: ArcGISMap | null | undefined): Promise<number> {
    const cached = this.nameToId.get(layerName);
    if (cached !== undefined) return cached;

    if (map) await this.discoverFromMap(map);

    const id = this.nameToId.get(layerName);
    if (id === undefined) {
      throw new LayerNameNotFoundError(layerName);
    }
    return id;
  }

  async resolveNameAsync(layerId: number, map: ArcGISMap | null | undefined): Promise<string> {
    const cached = this.idToName.get(layerId);
    if (cached !== undefined) return cached;

    if (map) await this.discoverFromMap(map);

    const name = this.idToName.get(layerId);
    if (name === undefined) {
      throw new LayerIdNotFoundError(layerId);
    }
    return name;
  }

  private async discoverFromMap(map: ArcGISMap): Promise<void> {
    const serviceUrls = new Set<string>();

    const collectUrls = (layer: Layer): void => {
      if (layer instanceof FeatureLayer && layer.url) {
        const serviceUrl = layer.url.replace(/\/\d+$/, '');
        serviceUrls.add(serviceUrl);
      }
    };

    map.allLayers.forEach(collectUrls);
    map.allTables?.forEach(collectUrls);

    await Promise.all([...serviceUrls].map((url) => this.registerFromServiceUrl(url)));
  }

  private async registerFromServiceUrl(serviceUrl: string): Promise<void> {
    if (this.fetchedServiceUrls.has(serviceUrl)) return;
    this.fetchedServiceUrls.add(serviceUrl);

    try {
      const response = await esriRequest(serviceUrl, { query: { f: 'json' }, responseType: 'json' });
      const metadata = response.data as FeatureServerMetadataJson;
      this.registerLayers(metadata.layers);
      this.registerLayers(metadata.tables);
    } catch {
      this.fetchedServiceUrls.delete(serviceUrl);
    }
  }

  private registerLayers(layers: FeatureServerMetadataJson['layers']): void {
    for (const layer of layers ?? []) {
      const existing = this.nameToId.get(layer.name);
      if (existing !== undefined && existing !== layer.id) {
        throw new LayerNameCollisionError(layer.name);
      }
      this.nameToId.set(layer.name, layer.id);
      this.idToName.set(layer.id, layer.name);
    }
  }
}
