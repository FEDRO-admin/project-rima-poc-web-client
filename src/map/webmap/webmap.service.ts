import { inject, Injectable, signal, Signal } from '@angular/core';
import WebMap from '@arcgis/core/WebMap';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Layer from '@arcgis/core/layers/Layer';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalItem from '@arcgis/core/portal/PortalItem';
import { Language } from '../../i18n/language';
import { languageInfos } from '../../i18n/language-info-config';
import { WebmapCollection } from './webmap-collection';
import { WebmapData } from './webmap-data';
import {
  WebmapFeatureLayer,
  WebmapGroupLayer,
  WebmapLayer,
  WebmapMapServiceLayer,
  WebmapWebTiledLayer,
} from './webmap-layer';
import { WebmapLeafLayerType } from './webmap-layer-type';
import { PortalService } from '../portal/portal.service';
import { LanguageStore } from '../../i18n/language.store';
import { RIMA_CATALOG_INCLUDED_LAYER_TYPES } from '../map-constants';
import { WebmapLanguageCategoryMissingError } from './webmap-errors';

const SDK_LAYER_TYPE_TO_WEBMAP_TYPE: Partial<Record<string, WebmapLeafLayerType>> = {
  feature: 'ArcGISFeatureLayer',
  'map-image': 'ArcGISMapServiceLayer',
  wmts: 'WebTiledLayer',
};

@Injectable({
  providedIn: 'root',
})
export class WebmapService {
  // signals
  public readonly webmapCollection: Signal<WebmapCollection | undefined>;
  private readonly writableWebmapCollection = signal<WebmapCollection | undefined>(undefined);

  private readonly languageStore = inject(LanguageStore);

  private loadPromise: Promise<WebmapCollection> | undefined;

  private readonly portalService = inject(PortalService);

  constructor() {
    this.webmapCollection = this.writableWebmapCollection.asReadonly();
  }

  async getWebmapCollection(): Promise<WebmapCollection> {
    // if tree already loaded for the language, return it
    if (this.webmapCollection()) {
      return this.webmapCollection()!;
    }

    // if a load is already in progress, return the existing promise
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
      throw new WebmapLanguageCategoryMissingError(language);
    }

    // query the portal for web maps in the language category
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

    const webmapCollection: WebmapCollection = {
      loadState: 'loaded',
      webmaps: children,
    };

    return webmapCollection;
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

        const group: WebmapGroupLayer = {
          id: `grouplayer:${webmapId}/${layer.id}`,
          layerId: layer.id!,
          type: 'GroupLayer',
          title: layer.title ?? '',
          layers: childLayers,
          visible: layer.visible,
          loadState: 'loaded',
        };
        result.push(group);
        continue;
      }

      const webmapType = this.toWebmapLayerType(layer);
      if (!webmapType) continue;

      switch (webmapType) {
        case 'ArcGISFeatureLayer': {
          const featureLayer = layer as FeatureLayer;
          const mapped: WebmapFeatureLayer = {
            id: `featurelayer:${webmapId}/${layer.id}`,
            layerId: layer.id!,
            type: 'ArcGISFeatureLayer',
            url: featureLayer.url ?? '',
            title: layer.title ?? '',
            layers: undefined,
            visible: layer.visible,
            loadState: 'loaded',
          };
          result.push(mapped);
          break;
        }
        case 'ArcGISMapServiceLayer': {
          const mapServiceLayer = layer as MapImageLayer;
          const mapped: WebmapMapServiceLayer = {
            id: `mapimagelayer:${webmapId}/${layer.id}`,
            layerId: layer.id!,
            type: 'ArcGISMapServiceLayer',
            url: mapServiceLayer.url ?? '',
            title: layer.title ?? '',
            layers: undefined,
            visible: layer.visible,
            loadState: 'loaded',
          };
          result.push(mapped);
          break;
        }
        case 'WebTiledLayer': {
          const wmtsLayer = layer as WMTSLayer;
          const mapped: WebmapWebTiledLayer = {
            id: `webtiledlayer:${webmapId}/${layer.id}`,
            layerId: layer.id!,
            type: 'WebTiledLayer',
            url: wmtsLayer.url ?? '',
            wmtsLayerIdentifier: wmtsLayer.activeLayer?.id,
            title: layer.title ?? '',
            layers: undefined,
            visible: layer.visible,
            loadState: 'loaded',
          };
          result.push(mapped);
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
      .slice(2); // skip "Categories" and language segment
  }
}
