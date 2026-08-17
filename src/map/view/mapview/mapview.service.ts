import { inject, Injectable } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import Layer from '@arcgis/core/layers/Layer';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalItem from '@arcgis/core/portal/PortalItem';
import Basemap from '@arcgis/core/Basemap';
import { PortalService } from '../../portal/portal.service';
import { LanguageStore } from '../../../i18n/language.store';
import { languageInfos } from '../../../i18n/language-info-config';
import { MapViewAlreadyRegisteredError } from '../../map-errors';
import {
  RIMA_MAPVIEW_BASEMAP_WMTS_URL,
  RIMA_MAPVIEW_BASEMAP_LAYER_ID,
  RIMA_MAPVIEW_HIDDEN_CATEGORY,
  RIMA_MAPVIEW_WRAP_WEBMAP_AS_GROUP,
} from './mapview-config';
import {
  MapViewInitialisationError,
  MapViewLanguageCategoryMissingError,
  MapViewLayerAddError,
} from './mapview-errors';
import { LayerService } from '../../layer/layer.service';
import { LayerIdResolver } from '../../layer/layer-id-resolver';
import { RIMA_ROOT_CATEGORY } from '../../map-config';
import type { WebmapDataJson } from '../../layer/layer-types';

interface CategoryNode {
  name: string;
  children: Map<string, CategoryNode>;
  layers: Layer[];
}

interface WebMapEntry {
  item: PortalItem;
  layers: Layer[];
}

@Injectable({
  providedIn: 'root',
})
export class MapViewService {
  private readonly portalService = inject(PortalService);
  private readonly languageStore = inject(LanguageStore);
  private readonly layerService = inject(LayerService);
  private readonly layerIdResolver = inject(LayerIdResolver);

  private _mapView: MapView | undefined;

  async init(mapElement: HTMLArcgisMapElement): Promise<void> {
    const view = mapElement.view;
    if (!view) {
      throw new MapViewInitialisationError('MapView is not available on the arcgis-map element');
    }

    this.registerMapView(view);
    this.addBasemap();
    await view.when();

    const [layers] = await Promise.all([
      this.loadWebMapLayers(),
      this.layerIdResolver.loadFromPortalCategory(RIMA_ROOT_CATEGORY),
    ]);
    this.addLayersToMap(layers);
  }

  getMapView(): MapView | undefined {
    return this._mapView;
  }

  private registerMapView(mapView: MapView): void {
    if (this._mapView) throw new MapViewAlreadyRegisteredError();
    this._mapView = mapView;
  }

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

  private addLayersToMap(layers: Layer[]): void {
    const view = this._mapView;
    if (!view?.map) {
      throw new MapViewLayerAddError();
    }
    view.map.addMany(layers);
  }

  private async loadWebMapLayers(): Promise<Layer[]> {
    const languageCategory = this.resolveLanguageCategory();

    const query = new PortalQueryParams({
      categories: [`/Categories/${languageCategory}`],
      query: 'type:"Web Map"',
      num: 100,
      sortField: 'title',
      sortOrder: 'asc',
    });

    const items: PortalItem[] = await this.portalService.queryItems(query);
    const entries: WebMapEntry[] = await Promise.all(items.map((item) => this.loadWebMapItem(item)));
    const validEntries = entries.filter((entry) => entry.layers.length > 0);

    const { rootNode, rootLayers } = this.buildCategoryTree(validEntries, languageCategory);
    const categoryLayers = this.convertTreeToLayers(rootNode);

    return [...categoryLayers, ...rootLayers].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')).reverse();
  }

  private async loadWebMapItem(item: PortalItem): Promise<WebMapEntry> {
    if (!item.id) return { item, layers: [] };

    const data: WebmapDataJson = await item.fetchData('json');
    const layers = this.layerService.parseWebmapJsonToLayers(data);

    if (layers.length === 0) return { item, layers: [] };

    if (RIMA_MAPVIEW_WRAP_WEBMAP_AS_GROUP) {
      return { item, layers: [new GroupLayer({ title: item.title ?? '', layers })] };
    }

    return { item, layers };
  }

  private buildCategoryTree(
    entries: WebMapEntry[],
    languageCategory: string,
  ): { rootNode: CategoryNode; rootLayers: Layer[] } {
    const rootNode: CategoryNode = { name: '', children: new Map(), layers: [] };
    const rootLayers: Layer[] = [];

    for (const entry of entries) {
      if (this.isHiddenCategory(entry.item)) {
        entry.layers.forEach((layer) => {
          layer.visible = false;
          layer.listMode = 'hide';
        });
        rootLayers.push(...entry.layers);
        continue;
      }

      const segments = this.extractCategorySegments(entry.item, languageCategory);
      if (segments.length === 0) {
        rootLayers.push(...entry.layers);
        continue;
      }

      let currentNode = rootNode;
      for (const segment of segments) {
        if (!currentNode.children.has(segment)) {
          currentNode.children.set(segment, { name: segment, children: new Map(), layers: [] });
        }
        currentNode = currentNode.children.get(segment)!;
      }
      currentNode.layers.push(...entry.layers);
    }

    return { rootNode, rootLayers };
  }

  private convertTreeToLayers(node: CategoryNode): Layer[] {
    const sortedChildren = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name));

    return sortedChildren.map((child) => {
      const childCategoryLayers = this.convertTreeToLayers(child);
      const allSublayers = [...childCategoryLayers, ...child.layers]
        .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
        .reverse();
      return new GroupLayer({ title: child.name, layers: allSublayers });
    });
  }

  private extractCategorySegments(item: PortalItem, languageCategory: string): string[] {
    const prefix = `/Categories/${languageCategory}`;
    const category = (item.categories ?? []).find((cat) => cat.startsWith(prefix));
    if (!category) return [];

    const remainder = category.slice(prefix.length);
    return remainder.split('/').filter((segment) => segment.length > 0);
  }

  private isHiddenCategory(item: PortalItem): boolean {
    return (item.categories ?? []).some((cat) => cat.split('/').includes(RIMA_MAPVIEW_HIDDEN_CATEGORY));
  }

  private resolveLanguageCategory(): string {
    const language = this.languageStore.activeLanguage();
    const languageCategory = languageInfos.find((info) => info.code === language)?.catalogId;
    if (!languageCategory) {
      throw new MapViewLanguageCategoryMissingError(language);
    }
    return languageCategory;
  }
}
