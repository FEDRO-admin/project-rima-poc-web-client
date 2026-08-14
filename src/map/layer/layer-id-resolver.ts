import { inject, Injectable } from '@angular/core';
import esriRequest from '@arcgis/core/request';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
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
        const response = await esriRequest(item.url, { query: { f: 'json' }, responseType: 'json' });
        const metadata = response.data as FeatureServerMetadataJson;
        this.registerLayers(metadata.layers);
        this.registerLayers(metadata.tables);
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
