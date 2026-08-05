import { inject, Injectable } from '@angular/core';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalItem from '@arcgis/core/portal/PortalItem';
import Layer from '@arcgis/core/layers/Layer';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import WebScene from '@arcgis/core/WebScene';
import { PortalService } from '../../portal/portal.service';
import { LanguageStore } from '../../../i18n/language.store';
import { languageInfos } from '../../../i18n/language-info-config';
import { RIMA_SCENEVIEW_3D_CATEGORY } from './sceneview-config';
import { isOfTypeRimaError } from '../../../error-handling/base-error';
import { SceneViewCatalogLoadError } from './sceneview-errors';

@Injectable({
  providedIn: 'root',
})
export class SceneViewLayerService {
  private readonly portalService = inject(PortalService);
  private readonly languageStore = inject(LanguageStore);

  private readonly sceneLayers = new WeakSet<Layer>();
  private cachedGroupLayer: GroupLayer | undefined;
  private cachedForLanguage: string | undefined;

  async load3DGroupLayer(): Promise<GroupLayer> {
    const language = this.languageStore.activeLanguage();
    const languageCategory = languageInfos.find((info) => info.code === language)?.catalogId;

    if (this.cachedGroupLayer && this.cachedForLanguage === languageCategory) {
      return this.cachedGroupLayer;
    }

    if (!languageCategory) {
      throw new SceneViewCatalogLoadError();
    }

    try {
      const items = await this.queryWebSceneItems(languageCategory);
      const groupLayer = await this.buildGroupHierarchy(items);
      this.cachedGroupLayer = groupLayer;
      this.cachedForLanguage = languageCategory;
      return groupLayer;
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
    this.cachedGroupLayer = undefined;
    this.cachedForLanguage = undefined;
  }

  private async queryWebSceneItems(languageCategory: string): Promise<PortalItem[]> {
    const query = new PortalQueryParams({
      categories: [`/Categories/${languageCategory}/${RIMA_SCENEVIEW_3D_CATEGORY}`],
      query: 'type:"Web Scene"',
      num: 100,
      sortField: 'title',
      sortOrder: 'asc',
    });

    return this.portalService.queryItems(query);
  }

  private async buildGroupHierarchy(items: PortalItem[]): Promise<GroupLayer> {
    const childGroups = await Promise.all(items.map((item) => this.loadWebSceneAsGroup(item)));
    const validGroups = childGroups.filter((group): group is GroupLayer => group !== undefined);

    return this.registerSceneLayer(new GroupLayer({ title: RIMA_SCENEVIEW_3D_CATEGORY, layers: validGroups }));
  }

  private async loadWebSceneAsGroup(item: PortalItem): Promise<GroupLayer | undefined> {
    try {
      const webScene = new WebScene({ portalItem: item });
      await webScene.loadAll();

      const layers = webScene.layers.toArray();
      webScene.layers.removeAll();

      layers.forEach((layer) => this.registerSceneLayer(layer));

      return this.registerSceneLayer(new GroupLayer({ title: item.title ?? '', layers }));
    } catch {
      return undefined;
    }
  }

  private registerSceneLayer<T extends Layer>(layer: T): T {
    this.sceneLayers.add(layer);
    return layer;
  }
}
