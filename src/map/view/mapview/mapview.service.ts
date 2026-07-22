import { inject, Injectable } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import WebMap from '@arcgis/core/WebMap';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
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
  RIMA_MAPVIEW_INCLUDED_LAYER_TYPES,
  RIMA_MAPVIEW_WRAP_WEBMAP_AS_GROUP,
} from './mapview-config';
import {
  MapViewInitialisationError,
  MapViewLanguageCategoryMissingError,
  MapViewLayerAddError,
} from './mapview-errors';
import { RIMA_SWITZERLAND_EXTENT } from '../../map-constants';

@Injectable({
  providedIn: 'root',
})
export class MapViewInitService {
  private readonly portalService = inject(PortalService);
  private readonly languageStore = inject(LanguageStore);

  private _mapView: MapView | undefined;

  async init(mapElement: HTMLArcgisMapElement): Promise<void> {
    const view = mapElement.view;
    if (!view) {
      throw new MapViewInitialisationError('MapView is not available on the arcgis-map element');
    }

    this.registerMapView(view);
    this.addBasemap();
    await view.when();

    const layers = await this.loadWebMapLayers();
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
    const layerGroups: Layer[][] = await Promise.all(items.map((item) => this.loadWebMapItem(item)));

    return layerGroups.flat();
  }

  private async loadWebMapItem(item: PortalItem): Promise<Layer[]> {
    if (!item.id) return [];

    const webMap = await new WebMap({ portalItem: item }).load();
    const layers = this.unpackWebmap(webMap);

    if (layers.length === 0) return [];

    if (RIMA_MAPVIEW_WRAP_WEBMAP_AS_GROUP) {
      return [new GroupLayer({ title: item.title ?? '', layers })];
    }

    return layers;
  }

  private unpackWebmap(webMap: WebMap): Layer[] {
    return this.parseLayers(webMap.layers.toArray());
  }

  private parseLayers(layers: Layer[]): Layer[] {
    const result: Layer[] = [];

    for (const layer of layers) {
      if (layer instanceof GroupLayer) {
        const children = this.parseLayers(layer.layers.toArray());
        if (children.length === 0) continue;
        layer.layers.removeAll();
        layer.layers.addMany(children);
        result.push(layer);
        continue;
      }

      if (!RIMA_MAPVIEW_INCLUDED_LAYER_TYPES.includes(layer.type)) continue;

      if (layer instanceof FeatureLayer) {
        const url = layer.layerId != null ? `${layer.url}/${layer.layerId}` : layer.url;
        result.push(
          new FeatureLayer({
            url,
            title: layer.title,
            visible: layer.visible,
            fullExtent: layer.fullExtent ?? RIMA_SWITZERLAND_EXTENT,
            outFields: ['*'],
          }),
        );
        continue;
      }

      result.push(layer);
    }

    return result;
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
