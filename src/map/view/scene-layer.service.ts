import { inject, Injectable } from '@angular/core';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalItem from '@arcgis/core/portal/PortalItem';
import Layer from '@arcgis/core/layers/Layer';
import { PortalService } from '../portal/portal.service';
import { LanguageStore } from '../../i18n/language.store';
import { languageInfos } from '../../i18n/language-info-config';
import { RIMA_3D_CATEGORY } from '../map-constants';
import { isOfTypeRimaError } from '../../error-handling/base-error';
import { SceneCatalogLoadError } from './scene-errors';

@Injectable({
  providedIn: 'root',
})
export class SceneLayerService {
  private readonly portalService = inject(PortalService);
  private readonly languageStore = inject(LanguageStore);

  private readonly sceneLayers = new WeakSet<Layer>();
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
    return this.sceneLayers.has(layer);
  }

  invalidateCache(): void {
    this.cachedLayers = undefined;
    this.cachedForLanguage = undefined;
  }

  private async querySceneItems(languageCategory: string): Promise<PortalItem[]> {
    const query = new PortalQueryParams({
      categories: [`/Categories/${languageCategory}/${RIMA_3D_CATEGORY}`],
      query: 'type:"Scene Service" OR type:"Scene Layer"',
      num: 100,
      sortField: 'title',
      sortOrder: 'asc',
    });

    return this.portalService.queryItems(query);
  }

  private async createLayers(items: PortalItem[]): Promise<Layer[]> {
    const results = await Promise.all(items.map((item) => this.createLayerFromItem(item)));
    return results.filter((result): result is Layer => result !== undefined);
  }

  private async createLayerFromItem(item: PortalItem): Promise<Layer | undefined> {
    try {
      const layer = await Layer.fromPortalItem({ portalItem: item });
      await layer.load();
      layer.title = item.title ?? '';
      this.sceneLayers.add(layer);
      return layer;
    } catch {
      return undefined;
    }
  }
}
