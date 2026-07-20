import { inject, Injectable } from '@angular/core';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalItem from '@arcgis/core/portal/PortalItem';
import Layer from '@arcgis/core/layers/Layer';
import { PortalService } from '../portal/portal.service';
import { LanguageStore } from '../../i18n/language.store';
import { languageInfos } from '../../i18n/language-info-config';
import { RIMA_3D_CATEGORY_SUFFIX } from '../map-constants';
import { isOfTypeRimaError } from '../../error-handling/base-error';
import { SceneCatalogLoadError } from './scene-errors';

const SCENE_LAYER_TAG = '__rima_3d_scene_layer__';

@Injectable({
  providedIn: 'root',
})
export class SceneLayerService {
  private readonly portalService = inject(PortalService);
  private readonly languageStore = inject(LanguageStore);

  private cachedLayers: Layer[] | undefined;
  private cachedForLanguage: string | undefined;

  async load3DLayers(): Promise<Layer[]> {
    const language = this.languageStore.activeLanguage();
    const languageCategory = languageInfos.find((info) => info.code === language)?.catalogId;

    if (this.cachedLayers && this.cachedForLanguage === languageCategory) {
      return this.cachedLayers;
    }

    if (!languageCategory) {
      throw new SceneCatalogLoadError();
    }

    try {
      const items = await this.querySceneItems(languageCategory);
      const layers = await this.createLayers(items);
      this.cachedLayers = layers;
      this.cachedForLanguage = languageCategory;
      return layers;
    } catch (error) {
      if (isOfTypeRimaError(error)) {
        throw error;
      }
      throw new SceneCatalogLoadError(error);
    }
  }

  isSceneLayer(layer: Layer): boolean {
    return (layer as unknown as Record<string, unknown>)[SCENE_LAYER_TAG] === true;
  }

  invalidateCache(): void {
    this.cachedLayers = undefined;
    this.cachedForLanguage = undefined;
  }

  private async querySceneItems(languageCategory: string): Promise<PortalItem[]> {
    const query = new PortalQueryParams({
      categories: [`/Categories/${languageCategory}/${RIMA_3D_CATEGORY_SUFFIX}`],
      query: 'type:"Scene Service" OR type:"Scene Layer"',
      num: 100,
      sortField: 'title',
      sortOrder: 'asc',
    });

    return this.portalService.queryItems(query);
  }

  private async createLayers(items: PortalItem[]): Promise<Layer[]> {
    const results = await Promise.all(items.map((item) => this.createLayerFromItem(item)));
    return results.filter((l): l is Layer => l !== undefined);
  }

  private async createLayerFromItem(item: PortalItem): Promise<Layer | undefined> {
    try {
      const layer = await Layer.fromPortalItem({ portalItem: item });
      await layer.load();
      layer.title = item.title ?? '';
      (layer as unknown as Record<string, unknown>)[SCENE_LAYER_TAG] = true;
      return layer;
    } catch {
      return undefined;
    }
  }
}
