import { inject, Injectable, Signal, signal } from '@angular/core';
import Basemap from '@arcgis/core/Basemap';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalItem from '@arcgis/core/portal/PortalItem';
import { PortalService } from '../../portal/portal.service';
import { RIMA_BASEMAP_CATEGORY } from '../../map-config';
import { LanguageStore } from '../../../i18n/language.store';
import { languageInfos } from '../../../i18n/language-info-config';
import { BasemapLoadError, MapViewLanguageCategoryMissingError, NoBasemapsFoundError } from './mapview-errors';

@Injectable({
  providedIn: 'root',
})
export class BasemapService {
  private readonly portalService = inject(PortalService);
  private readonly languageStore = inject(LanguageStore);

  public readonly basemaps: Signal<Basemap[]>;
  private readonly writableBasemaps = signal<Basemap[]>([]);

  constructor() {
    this.basemaps = this.writableBasemaps.asReadonly();
  }

  async loadBasemaps(): Promise<Basemap[]> {
    const cached = this.writableBasemaps();
    if (cached.length > 0) return cached;

    try {
      const languageCategory = this.resolveLanguageCategory();

      const query = new PortalQueryParams({
        categories: [`/Categories/${languageCategory}/${RIMA_BASEMAP_CATEGORY}`],
        query: 'type:"Web Map"',
        num: 100,
        sortField: 'title',
        sortOrder: 'asc',
      });

      const items: PortalItem[] = await this.portalService.queryItems(query);

      if (items.length === 0) {
        throw new NoBasemapsFoundError();
      }

      const basemaps = items.map(
        (item) =>
          new Basemap({
            portalItem: item,
          }),
      );

      this.writableBasemaps.set(basemaps);
      return basemaps;
    } catch (error) {
      if (error instanceof NoBasemapsFoundError) throw error;
      throw new BasemapLoadError(error);
    }
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
