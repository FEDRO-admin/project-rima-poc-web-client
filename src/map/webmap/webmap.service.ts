import { inject, Injectable, signal, Signal } from '@angular/core';
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
import { WebmapLayerType } from './webmap-layer-type';
import { RawWebmapLayer } from './raw-webmap-layer';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalItem from '@arcgis/core/portal/PortalItem';
import esriRequest from '@arcgis/core/request';
import { PortalService } from '../portal/portal.service';
import { LanguageStore } from '../../i18n/language.store';
import { RIMA_CATALOG_INCLUDED_LAYER_TYPES } from '../map-constants';
import { WebmapLanguageCategoryMissingError } from './webmap-errors';

@Injectable({
  providedIn: 'root',
})
export class WebmapService {
  // signals
  public readonly webmapCollection: Signal<WebmapCollection | undefined>;
  private readonly writableWebmapCollection = signal<WebmapCollection | undefined>(undefined);

  public readonly languageStore = inject(LanguageStore);

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

    // fetch the webmap JSON spec for each item in parallel
    // this avoids loading all webmaps and gets light metadata instead...
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
    if (!item.id) return undefined;

    const itemEndpoint = await this.portalService.getPortalItemEndpoint();
    const response = await esriRequest(`${itemEndpoint}/${item.id}/data`, { query: { f: 'json' } });

    const rawWebmapLayers: RawWebmapLayer[] = response.data?.operationalLayers;

    if (!rawWebmapLayers || !rawWebmapLayers.length) return undefined;

    if (!item.categories) return undefined;

    const webmapData: WebmapData = {
      portalItemId: item.id!,
      title: item.title ?? '',
      categorySegments: this.extractCategorySegments(item.categories ?? []),
      layers: this.parseRawWebmapLayers([...rawWebmapLayers].reverse(), item.id!), // reverse to keep webmap layer order
    };

    return webmapData;
  }

  private parseRawWebmapLayers(rawWebmapLayers: RawWebmapLayer[], webmapId: string): WebmapLayer[] {
    const result: WebmapLayer[] = [];
    for (const layer of rawWebmapLayers) {
      if (layer.layerType === 'GroupLayer' && layer.layers) {
        const childLayers = this.parseRawWebmapLayers([...layer.layers].reverse(), webmapId);
        if (childLayers.length === 0) continue;
        const group: WebmapGroupLayer = {
          id: `grouplayer:${webmapId}/${layer.id}`,
          layerId: layer.id,
          type: 'GroupLayer',
          title: layer.title,
          layers: childLayers,
          visible: layer.visibility ?? true,
          loadState: 'loaded',
        };
        result.push(group);
      } else if (RIMA_CATALOG_INCLUDED_LAYER_TYPES.includes(layer.layerType as WebmapLayerType)) {
        switch (layer.layerType) {
          case 'ArcGISFeatureLayer': {
            const featureLayer: WebmapFeatureLayer = {
              id: `featurelayer:${webmapId}/${layer.id}`,
              layerId: layer.id,
              type: 'ArcGISFeatureLayer',
              url: layer.url ?? '',
              title: layer.title,
              layers: undefined,
              visible: layer.visibility ?? true,
              loadState: 'loaded',
            };
            result.push(featureLayer);
            break;
          }
          case 'ArcGISMapServiceLayer': {
            const mapServiceLayer: WebmapMapServiceLayer = {
              id: `mapimagelayer:${webmapId}/${layer.id}`,
              layerId: layer.id,
              type: 'ArcGISMapServiceLayer',
              url: layer.url ?? '',
              title: layer.title,
              layers: undefined,
              visible: layer.visibility ?? true,
              loadState: 'loaded',
            };
            result.push(mapServiceLayer);
            break;
          }
          case 'WebTiledLayer': {
            const webTiledLayer: WebmapWebTiledLayer = {
              id: `webtiledlayer:${webmapId}/${layer.id}`,
              layerId: layer.id,
              type: 'WebTiledLayer',
              url: layer.wmtsInfo?.url ?? layer.templateUrl ?? layer.url ?? '',
              wmtsLayerIdentifier: layer.wmtsInfo?.layerIdentifier,
              title: layer.title,
              layers: undefined,
              visible: layer.visibility ?? true,
              loadState: 'loaded',
            };
            result.push(webTiledLayer);
            break;
          }
        }
      }
    }
    return result;
  }

  private extractCategorySegments(categories: string[]): string[] {
    if (!categories.length) return [];
    return categories[0]
      .split('/')
      .filter((s) => s.length > 0)
      .slice(2); // skip "Categories" and language segment
  }
}
