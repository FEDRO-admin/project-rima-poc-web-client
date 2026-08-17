import { inject, Injectable } from '@angular/core';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalItem from '@arcgis/core/portal/PortalItem';
import Layer from '@arcgis/core/layers/Layer';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import SceneLayer from '@arcgis/core/layers/SceneLayer';
import WebScene from '@arcgis/core/WebScene';
import { PortalService } from '../../portal/portal.service';
import { LanguageStore } from '../../../i18n/language.store';
import { languageInfos } from '../../../i18n/language-info-config';
import { RIMA_SCENEVIEW_HIDDEN_CATEGORY } from './sceneview-config';
import { isOfTypeRimaError } from '../../../error-handling/base-error';
import { SceneViewCatalogLoadError } from './sceneview-errors';
import { buildCategoryTree, convertTreeToLayers, type PortalItemEntry } from '../../shared/category-tree';

@Injectable({
  providedIn: 'root',
})
export class SceneViewLayerService {
  private readonly portalService = inject(PortalService);
  private readonly languageStore = inject(LanguageStore);

  private readonly sceneLayers = new WeakSet<Layer>();
  private cachedLayers: Layer[] | undefined;
  private cachedForLanguage: string | undefined;

  async loadSceneLayers(): Promise<Layer[]> {
    const language = this.languageStore.activeLanguage();
    const languageCategory = languageInfos.find((info) => info.code === language)?.catalogId;

    if (this.cachedLayers && this.cachedForLanguage === languageCategory) {
      return this.cachedLayers;
    }

    if (!languageCategory) {
      throw new SceneViewCatalogLoadError();
    }

    try {
      const items = await this.queryWebSceneItems(languageCategory);
      const layers = await this.buildSceneLayerHierarchy(items, languageCategory);
      this.cachedLayers = layers;
      this.cachedForLanguage = languageCategory;
      return layers;
    } catch (error) {
      if (isOfTypeRimaError(error)) {
        throw error;
      }
      throw new SceneViewCatalogLoadError(error);
    }
  }

  isSceneLayer(layer: Layer): boolean {
    return this.sceneLayers.has(layer);
  }

  invalidateCache(): void {
    this.cachedLayers = undefined;
    this.cachedForLanguage = undefined;
  }

  private async queryWebSceneItems(languageCategory: string): Promise<PortalItem[]> {
    const query = new PortalQueryParams({
      categories: [`/Categories/${languageCategory}`],
      query: 'type:"Web Scene"',
      num: 100,
      sortField: 'title',
      sortOrder: 'asc',
    });

    return this.portalService.queryItems(query);
  }

  private async buildSceneLayerHierarchy(items: PortalItem[], languageCategory: string): Promise<Layer[]> {
    const entries: PortalItemEntry[] = await Promise.all(
      items.map(async (item) => {
        const layers = await this.loadWebSceneLayers(item);
        return { item, layers };
      }),
    );
    const validEntries = entries.filter((entry) => entry.layers.length > 0);

    const { rootNode, rootLayers } = buildCategoryTree(validEntries, languageCategory, RIMA_SCENEVIEW_HIDDEN_CATEGORY);
    const categoryLayers = convertTreeToLayers(rootNode);

    const allLayers = [...categoryLayers, ...rootLayers]
      .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
      .reverse();

    allLayers.forEach((layer) => this.registerSceneLayerRecursive(layer));
    return allLayers;
  }

  private async loadWebSceneLayers(item: PortalItem): Promise<Layer[]> {
    try {
      const webScene = new WebScene({ portalItem: item });
      await webScene.loadAll();

      const layers = webScene.layers.toArray();
      webScene.layers.removeAll();

      this.configureSceneLayers(layers);
      return [new GroupLayer({ title: item.title ?? '', layers })];
    } catch {
      return [];
    }
  }

  private configureSceneLayers(layers: Layer[]): void {
    for (const layer of layers) {
      if (layer instanceof SceneLayer) {
        layer.outFields = ['*'];
      } else if (layer instanceof GroupLayer) {
        this.configureSceneLayers(layer.layers.toArray());
      }
    }
  }

  private registerSceneLayerRecursive(layer: Layer): void {
    this.sceneLayers.add(layer);
    if (layer instanceof GroupLayer) {
      layer.layers.forEach((child) => this.registerSceneLayerRecursive(child));
    }
  }
}
