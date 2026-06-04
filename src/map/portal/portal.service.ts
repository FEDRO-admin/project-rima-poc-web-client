import { Injectable } from '@angular/core';
import Portal from '@arcgis/core/portal/Portal';
import { RIMA_PORTAL_URL } from '../map-constants';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalQueryResult from '@arcgis/core/portal/PortalQueryResult';
import PortalItem from '@arcgis/core/portal/PortalItem';
import { isOfTypeRimaError } from '../../error-handling/base-error';
import { PortalLoadError, PortalRestUrlMissingError as PortalInvalidError } from './portal-errors';

@Injectable({
  providedIn: 'root',
})
export class PortalService {
  private cachedPortal: Portal | undefined;
  private loadPromise: Promise<Portal> | undefined;

  async getPortal(): Promise<Portal> {
    if (this.cachedPortal) {
      return this.cachedPortal;
    }

    if (this.loadPromise) {
      return await this.loadPromise;
    }

    const portal = new Portal({ url: RIMA_PORTAL_URL, authMode: 'immediate' });
    this.loadPromise = portal.load();

    try {
      await this.loadPromise;
    } catch (error) {
      this.loadPromise = undefined;
      if (isOfTypeRimaError(error)) {
        throw error;
      }
      throw new PortalLoadError(error);
    }

    this.cachedPortal = portal;
    return portal;
  }

  async getPortalItemEndpoint(): Promise<string> {
    return `${await this.getRestUrl()}/content/items`;
  }

  async queryItems(query: PortalQueryParams): Promise<PortalItem[]> {
    const portal = await this.getPortal();
    const result: PortalQueryResult<object> = await portal.queryItems(query);
    const items: PortalItem[] = result.results as PortalItem[];
    return items;
  }

  private async getRestUrl(): Promise<string> {
    const restUrl = (await this.getPortal()).restUrl;
    if (!restUrl) {
      throw new PortalInvalidError();
    }
    return restUrl;
  }
}
