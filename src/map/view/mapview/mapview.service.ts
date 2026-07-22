import { inject, Injectable, signal, Signal } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import WebMap from '@arcgis/core/WebMap';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Layer from '@arcgis/core/layers/Layer';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalItem from '@arcgis/core/portal/PortalItem';
import Basemap from '@arcgis/core/Basemap';
import { PortalService } from '../../portal/portal.service';
import { LanguageStore } from '../../../i18n/language.store';
import { Language } from '../../../i18n/language';
import { languageInfos } from '../../../i18n/language-info-config';
import { LayerService } from '../../layer/layer.service';
import { MapViewAlreadyRegisteredError } from '../../map-errors';
import {
  RIMA_MAPVIEW_BASEMAP_WMTS_URL,
  RIMA_MAPVIEW_BASEMAP_LAYER_ID,
  RIMA_CATALOG_INCLUDED_LAYER_TYPES,
  RIMA_CATALOG_WEBMAP_NAME_AS_SECTION,
} from './mapview-config';
import {
  MapViewInitialisationError,
  MapViewCatalogLoadError,
  MapViewLanguageCategoryMissingError,
  MapViewLayerAddError,
} from './mapview-errors';
import {
  Catalog,
  CatalogItem,
  CatalogSection,
  CatalogSectionOrigin,
  CatalogLayer,
  CatalogFeatureLayer,
  CatalogMapImageLayer,
  CatalogWebTiledLayer,
  CatalogLeafEntry,
  CatalogPathSegment,
  WebmapCollection,
  WebmapData,
  WebmapLayer,
  WebmapLeafLayerType,
} from './mapview-types';
import { isOfTypeRimaError } from '../../../error-handling/base-error';

const SDK_LAYER_TYPE_TO_WEBMAP_TYPE: Partial<Record<string, WebmapLeafLayerType>> = {
  feature: 'ArcGISFeatureLayer',
  'map-image': 'ArcGISMapServiceLayer',
  wmts: 'WebTiledLayer',
};

@Injectable({
  providedIn: 'root',
})
export class MapViewInitService {
  public readonly webmapCollection: Signal<WebmapCollection | undefined>;
  private readonly writableWebmapCollection = signal<WebmapCollection | undefined>(undefined);

  private readonly portalService = inject(PortalService);
  private readonly languageStore = inject(LanguageStore);
  private readonly layerService = inject(LayerService);

  private _mapView: MapView | undefined;
  private loadPromise: Promise<WebmapCollection> | undefined;

  constructor() {
    this.webmapCollection = this.writableWebmapCollection.asReadonly();
  }

  async init(mapEl: HTMLArcgisMapElement): Promise<void> {
    const view = mapEl.view;
    if (!view) {
      throw new MapViewInitialisationError('MapView is not available on the arcgis-map element');
    }

    this.registerMapView(view);
    this.addBasemap();
    await view.when();

    const catalog = await this.buildCatalog();
    this.addCatalogToMap(catalog);
  }

  getMapView(): MapView | undefined {
    return this._mapView;
  }

  // ── MapView registration ──

  private registerMapView(mapView: MapView): void {
    if (this._mapView) throw new MapViewAlreadyRegisteredError();
    this._mapView = mapView;
  }

  // ── Basemap ──

  private addBasemap(): void {
    const view = this._mapView;
    if (!view?.map) throw new Error('Map view not registered');

    const swisstopoLayer = new WMTSLayer({
      url: RIMA_MAPVIEW_BASEMAP_WMTS_URL,
      activeLayer: { id: RIMA_MAPVIEW_BASEMAP_LAYER_ID },
    });

    view.map.basemap = new Basemap({
      baseLayers: [swisstopoLayer],
      title: 'Swisstopo Pixelkarte',
      id: 'swisstopo',
    });
  }

  // ── Catalog building ──

  private async buildCatalog(): Promise<Catalog> {
    try {
      const webmapCollection = await this.getWebmapCollection();
      return this.buildCatalogFromCollection(webmapCollection);
    } catch (error) {
      if (isOfTypeRimaError(error)) {
        throw error;
      }
      throw new MapViewCatalogLoadError(error);
    }
  }

  private addCatalogToMap(catalog: Catalog): void {
    const view = this._mapView;
    if (!view?.map) {
      throw new MapViewLayerAddError();
    }

    const layers = this.layerService.buildLayersFromCatalog(catalog);
    view.map.addMany(layers);
  }

  // ── Webmap loading ──

  private async getWebmapCollection(): Promise<WebmapCollection> {
    if (this.webmapCollection()) {
      return this.webmapCollection()!;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.loadWebmapCollection(this.languageStore.activeLanguage());

    try {
      const webmapCollection = await this.loadPromise;
      this.writableWebmapCollection.set(webmapCollection);
      return webmapCollection;
    } finally {
      this.loadPromise = undefined;
    }
  }

  private async loadWebmapCollection(language: Language): Promise<WebmapCollection> {
    const languageCategory = languageInfos.find((info) => info.code === language)?.catalogId;
    if (!languageCategory) {
      throw new MapViewLanguageCategoryMissingError(language);
    }

    const query = new PortalQueryParams({
      categories: [`/Categories/${languageCategory}`],
      query: 'type:"Web Map"',
      num: 100,
      sortField: 'title',
      sortOrder: 'asc',
    });

    const items: PortalItem[] = await this.portalService.queryItems(query);

    const children: WebmapData[] = (await Promise.all(items.map((item) => this.loadWebmapNode(item)))).filter(
      (node): node is WebmapData => node !== undefined,
    );

    return {
      loadState: 'loaded',
      webmaps: children,
    };
  }

  private async loadWebmapNode(item: PortalItem): Promise<WebmapData | undefined> {
    if (!item.id || !item.categories) return undefined;

    const webMap = new WebMap({ portalItem: item });
    await webMap.load();

    const layers = this.transformWebMapLayers(webMap.layers.toArray(), item.id);
    if (!layers.length) return undefined;

    return {
      portalItemId: item.id,
      title: item.title ?? '',
      categorySegments: this.extractCategorySegments(item.categories),
      layers,
    };
  }

  private transformWebMapLayers(sdkLayers: Layer[], webmapId: string): WebmapLayer[] {
    const result: WebmapLayer[] = [];

    for (const layer of [...sdkLayers].reverse()) {
      if (layer.type === 'group') {
        const groupLayer = layer as GroupLayer;
        const childLayers = this.transformWebMapLayers(groupLayer.layers.toArray(), webmapId);
        if (childLayers.length === 0) continue;

        result.push({
          id: `grouplayer:${webmapId}/${layer.id}`,
          layerId: layer.id!,
          type: 'GroupLayer',
          title: layer.title ?? '',
          layers: childLayers,
          visible: layer.visible,
          loadState: 'loaded',
        });
        continue;
      }

      const webmapType = this.toWebmapLayerType(layer);
      if (!webmapType) continue;

      switch (webmapType) {
        case 'ArcGISFeatureLayer': {
          const featureLayer = layer as FeatureLayer;
          result.push({
            id: `featurelayer:${webmapId}/${layer.id}`,
            layerId: layer.id!,
            type: 'ArcGISFeatureLayer',
            url:
              featureLayer.layerId != null ? `${featureLayer.url}/${featureLayer.layerId}` : (featureLayer.url ?? ''),
            title: layer.title ?? '',
            layers: undefined,
            visible: layer.visible,
            loadState: 'loaded',
          });
          break;
        }
        case 'ArcGISMapServiceLayer': {
          const mapServiceLayer = layer as MapImageLayer;
          result.push({
            id: `mapimagelayer:${webmapId}/${layer.id}`,
            layerId: layer.id!,
            type: 'ArcGISMapServiceLayer',
            url: mapServiceLayer.url ?? '',
            title: layer.title ?? '',
            layers: undefined,
            visible: layer.visible,
            loadState: 'loaded',
          });
          break;
        }
        case 'WebTiledLayer': {
          const wmtsLayer = layer as WMTSLayer;
          result.push({
            id: `webtiledlayer:${webmapId}/${layer.id}`,
            layerId: layer.id!,
            type: 'WebTiledLayer',
            url: wmtsLayer.url ?? '',
            wmtsLayerIdentifier: wmtsLayer.activeLayer?.id,
            title: layer.title ?? '',
            layers: undefined,
            visible: layer.visible,
            loadState: 'loaded',
          });
          break;
        }
      }
    }

    return result;
  }

  private toWebmapLayerType(layer: Layer): WebmapLeafLayerType | undefined {
    const webmapType = SDK_LAYER_TYPE_TO_WEBMAP_TYPE[layer.type];
    if (!webmapType || !RIMA_CATALOG_INCLUDED_LAYER_TYPES.includes(webmapType)) {
      return undefined;
    }
    return webmapType;
  }

  private extractCategorySegments(categories: string[]): string[] {
    if (!categories.length) return [];
    return categories[0]
      .split('/')
      .filter((s) => s.length > 0)
      .slice(2);
  }

  // ── Catalog tree building ──

  private buildCatalogFromCollection(webmapCollection: WebmapCollection): Catalog {
    const catalog: Catalog = {
      loadState: 'loaded',
      items: [],
    };

    if (!webmapCollection.webmaps) {
      return catalog;
    }

    const entries = this.collectLeafEntries(webmapCollection);

    entries.forEach((entry) => {
      this.depositAtPath(catalog.items, entry.path, entry.leaf);
    });

    return catalog;
  }

  private collectLeafEntries(webmapCollection: WebmapCollection): CatalogLeafEntry[] {
    const entries: CatalogLeafEntry[] = [];

    const sortedWebmaps = [...webmapCollection.webmaps].sort((a, b) => {
      const categoryComparison = a.categorySegments.join('/').localeCompare(b.categorySegments.join('/'));
      if (categoryComparison !== 0) {
        return categoryComparison;
      }
      return a.title.localeCompare(b.title);
    });

    for (const webmap of sortedWebmaps) {
      const basePath: CatalogPathSegment[] = [];

      for (const seg of webmap.categorySegments) {
        basePath.push({ id: `category:${seg}`, title: seg, origin: 'category' });
      }

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
