import { inject, Injectable, signal, Signal } from '@angular/core';
import {
  CatalogSection,
  CatalogSectionOrigin,
  CatalogItem,
  CatalogLayer,
  CatalogFeatureLayer,
  CatalogMapImageLayer,
  CatalogWebTiledLayer,
  Catalog,
  LoadingState,
} from './catalog-types';
import { CatalogLeafEntry } from './catalog-leaf-entry';
import { CatalogPathSegment } from './catalog-path-segment';
import { WebmapService } from '../webmap/webmap.service';
import { WebmapLayer, WebmapCollection } from '../webmap/webmap-types';
import { RIMA_CATALOG_WEBMAP_NAME_AS_SECTION } from '../map-constants';

@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly webmapService = inject(WebmapService);

  public readonly catalog: Signal<Catalog | undefined>;
  public readonly loadState: Signal<LoadingState>;

  private readonly writableCatalog = signal<Catalog | undefined>(undefined);
  private readonly writableLoadState = signal<LoadingState>(undefined);

  constructor() {
    this.catalog = this.writableCatalog.asReadonly();
    this.loadState = this.writableLoadState.asReadonly();
  }

  async buildMapCatalog(): Promise<Catalog> {
    this.writableLoadState.set('loading');
    try {
      const webmapCollection = await this.webmapService.getWebmapCollection();
      const catalog = this.buildMapCatalogFromCollection(webmapCollection);
      this.writableCatalog.set(catalog);
      this.writableLoadState.set('loaded');
      return catalog;
    } catch (error) {
      this.writableLoadState.set('error');
      throw error;
    }
  }

  private buildMapCatalogFromCollection(webmapCollection: WebmapCollection): Catalog {
    const catalog: Catalog = {
      loadState: 'loaded',
      items: [],
    };

    if (!webmapCollection.webmaps) {
      return catalog;
    }

    const entries: CatalogLeafEntry[] = this.collectLeafEntries(webmapCollection);

    for (const entry of entries) {
      this.depositAtPath(catalog.items, entry.path, entry.leaf);
    }

    return catalog;
  }

  private collectLeafEntries(webmapCollection: WebmapCollection): CatalogLeafEntry[] {
    const entries: CatalogLeafEntry[] = [];

    for (const webmap of webmapCollection.webmaps) {
      const basePath: CatalogPathSegment[] = [];

      // first, push category segments as path segments
      for (const seg of webmap.categorySegments) {
        basePath.push({ id: `category:${seg}`, title: seg, origin: 'category' });
      }

      // then push the webmap itself as a path segment
      if (RIMA_CATALOG_WEBMAP_NAME_AS_SECTION) {
        basePath.push({ id: `webmap:${webmap.portalItemId}`, title: webmap.title, origin: 'webmap' });
      }

      this.collectLayerEntries(webmap.layers, webmap.portalItemId, basePath, entries);
    }

    return entries;
  }

  private collectLayerEntries(
    layers: WebmapLayer[],
    webMapItemId: string,
    currentPath: CatalogPathSegment[],
    entries: CatalogLeafEntry[],
  ): void {
    for (const layer of layers) {
      switch (layer.type) {
        case 'GroupLayer': {
          const groupSegment: CatalogPathSegment = {
            id: `group:${webMapItemId}/${layer.layerId}`,
            title: layer.title,
            origin: 'group-layer',
          };
          this.collectLayerEntries(layer.layers, webMapItemId, [...currentPath, groupSegment], entries);
          break;
        }
        case 'ArcGISFeatureLayer': {
          const leaf: CatalogFeatureLayer = {
            id: `layer:${webMapItemId}/${layer.layerId}`,
            title: layer.title,
            type: 'feature-layer',
            webMapItemId,
            layerId: layer.layerId,
            url: layer.url,
            items: undefined,
            visible: layer.visible,
            loadState: 'loaded',
          };
          entries.push({ path: currentPath, leaf });
          break;
        }
        case 'ArcGISMapServiceLayer': {
          const leaf: CatalogMapImageLayer = {
            id: `layer:${webMapItemId}/${layer.layerId}`,
            title: layer.title,
            type: 'map-image-layer',
            webMapItemId,
            layerId: layer.layerId,
            url: layer.url,
            items: undefined,
            visible: layer.visible,
            loadState: 'loaded',
          };
          entries.push({ path: currentPath, leaf });
          break;
        }
        case 'WebTiledLayer': {
          const leaf: CatalogWebTiledLayer = {
            id: `layer:${webMapItemId}/${layer.layerId}`,
            title: layer.title,
            type: 'web-tiled-layer',
            webMapItemId,
            layerId: layer.layerId,
            url: layer.url,
            wmtsLayerIdentifier: layer.wmtsLayerIdentifier,
            items: undefined,
            visible: layer.visible,
            loadState: 'loaded',
          };
          entries.push({ path: currentPath, leaf });
          break;
        }
      }
    }
  }

  private depositAtPath(currentItems: CatalogItem[], path: CatalogPathSegment[], leaf: CatalogLayer): void {
    if (path.length === 0) {
      currentItems.push(leaf);
      return;
    }

    const [segment, ...rest] = path;
    const section = this.getOrCreateSection(currentItems, segment.id, segment.title, segment.origin);
    this.depositAtPath(section.items, rest, leaf);
  }

  private getOrCreateSection(
    currentItems: CatalogItem[],
    id: string,
    title: string,
    origin: CatalogSectionOrigin,
  ): CatalogSection {
    const existing = currentItems.find((item) => item.id === id);
    if (existing) {
      return existing as CatalogSection;
    }

    const section: CatalogSection = {
      id,
      title,
      type: 'section',
      origin,
      items: [],
      visible: true,
      loadState: 'loaded',
    };
    currentItems.push(section);
    return section;
  }
}
