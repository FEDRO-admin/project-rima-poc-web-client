import { inject, Injectable } from '@angular/core';
import WebMap from '@arcgis/core/WebMap';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import { Language } from '../../i18n/language';
import { languageInfos } from '../../i18n/language-info-config';
import { PortalService } from '../portal/portal.service';
import { LanguageStore } from '../../i18n/language.store';
import { WebmapLanguageCategoryMissingError, WebmapNotFoundError } from './webmap-errors';

@Injectable({
  providedIn: 'root',
})
export class WebmapService {
  private readonly languageStore = inject(LanguageStore);
  private readonly portalService = inject(PortalService);

  private loadPromise: Promise<WebMap> | undefined;

  async loadWebMap(): Promise<WebMap> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.doLoad(this.languageStore.activeLanguage());

    try {
      return await this.loadPromise;
    } finally {
      this.loadPromise = undefined;
    }
  }

  private async doLoad(language: Language): Promise<WebMap> {
    const languageCategory = languageInfos.find((info) => info.code === language)?.catalogId;
    if (!languageCategory) {
      throw new WebmapLanguageCategoryMissingError(language);
    }

    const query = new PortalQueryParams({
      categories: [`/Categories/${languageCategory}`],
      query: 'type:"Web Map"',
      num: 1,
      sortField: 'title',
      sortOrder: 'asc',
    });

    const items = await this.portalService.queryItems(query);
    if (!items.length) {
      throw new WebmapNotFoundError(languageCategory);
    }

    const webMap = new WebMap({ portalItem: items[0] });
    await webMap.load();
    return webMap;
  }
}
