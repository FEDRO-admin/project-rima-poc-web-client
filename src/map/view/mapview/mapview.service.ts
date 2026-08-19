import { inject, Injectable } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import Layer from '@arcgis/core/layers/Layer';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalItem from '@arcgis/core/portal/PortalItem';
import { PortalService } from '../../portal/portal.service';
import { LanguageStore } from '../../../i18n/language.store';
import { languageInfos } from '../../../i18n/language-info-config';
import { MapViewAlreadyRegisteredError } from '../../map-errors';
import { RIMA_MAPVIEW_HIDDEN_CATEGORY, RIMA_MAPVIEW_WRAP_WEBMAP_AS_GROUP } from './mapview-config';
import { BasemapService } from '../basemap/basemap.service';
import {
  MapViewInitialisationError,
  MapViewLanguageCategoryMissingError,
  MapViewLayerAddError,
} from './mapview-errors';
import { LayerService } from '../../layer/layer.service';
import { LayerIdResolver } from '../../layer/layer-id-resolver';
import { RIMA_ROOT_CATEGORY } from '../../map-config';
import type { WebmapDataJson } from '../../layer/layer-types';
import { buildCategoryTree, convertTreeToLayers, type PortalItemEntry } from '../../shared/category-tree';

@Injectable({
  providedIn: 'root',
})
export class MapViewService {
  private readonly portalService = inject(PortalService);
  private readonly languageStore = inject(LanguageStore);
  private readonly layerService = inject(LayerService);
  private readonly layerIdResolver = inject(LayerIdResolver);
  private readonly basemapService = inject(BasemapService);

  private _mapView: MapView | undefined;

  async init(mapElement: HTMLArcgisMapElement): Promise<void> {
    const view = mapElement.view;
    if (!view) {
      throw new MapViewInitialisationError('MapView is not available on the arcgis-map element');
    }

    this.registerMapView(view);
    await this.applyDefaultBasemap();
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

  private async applyDefaultBasemap(): Promise<void> {
    const view = this._mapView;
    if (!view?.map) throw new Error('Map view not registered');

    view.map.basemap = await this.basemapService.getDefault2DBasemap();
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
    const entries: PortalItemEntry[] = await Promise.all(items.map((item) => this.loadWebMapItem(item)));
    const validEntries = entries.filter((entry) => entry.layers.length > 0);

    const { rootNode, rootLayers } = buildCategoryTree(validEntries, languageCategory, RIMA_MAPVIEW_HIDDEN_CATEGORY);
    const categoryLayers = convertTreeToLayers(rootNode);

    return [...categoryLayers, ...rootLayers].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')).reverse();
  }

  private async loadWebMapItem(item: PortalItem): Promise<PortalItemEntry> {
    if (!item.id) return { item, layers: [] };

    const data: WebmapDataJson = await item.fetchData('json');
    const layers = this.layerService.parseWebmapJsonToLayers(data);

    if (layers.length === 0) return { item, layers: [] };

    if (RIMA_MAPVIEW_WRAP_WEBMAP_AS_GROUP) {
      return { item, layers: [new GroupLayer({ title: item.title ?? '', layers })] };
    }

    return { item, layers };
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
