import { computed, Injectable, signal, Signal } from '@angular/core';
import Portal from '@arcgis/core/portal/Portal';
import { RIMA_PORTAL_URL } from '../map-constants';
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams';
import PortalQueryResult from '@arcgis/core/portal/PortalQueryResult';
import PortalItem from '@arcgis/core/portal/PortalItem';
import { PortalRestUrlMissingError as PortalInvalidError } from './portal-errors';

@Injectable({
  providedIn: 'root',
})
export class PortalService {
  public readonly portal: Signal<Portal | undefined>;
  private readonly writablePortal = signal<Portal | undefined>(undefined);

  public readonly restUrl: Signal<string> = computed(() => {
    const restUrl = this.portal()?.restUrl;
    if (restUrl) {
      return restUrl;
    }
    throw new PortalInvalidError();
  });

  public readonly portalEndpoint: Signal<string> = computed(() => {
    return `${this.restUrl()}/portals/${this.portal()?.id}`;
  });

  public readonly portalItemEndpoint: Signal<string> = computed(() => {
    return `${this.restUrl()}/content/items`;
  });

  private loadPromise: Promise<Portal> | undefined;

  constructor() {
    this.portal = this.writablePortal.asReadonly();
  }

  async getPortal(): Promise<Portal> {
    if (this.portal()) {
      return this.portal()!;
    }

    if (this.loadPromise) {
      return await this.loadPromise;
    }

    const portal = new Portal({ url: RIMA_PORTAL_URL, authMode: 'immediate' });
    this.loadPromise = portal.load();

    try {
      await this.loadPromise;
    } catch (e) {
      this.loadPromise = undefined; // allow retry on next call
      throw e;
    }

    this.writablePortal.set(portal);
    return portal;
  }

  async queryItems(query: PortalQueryParams): Promise<PortalItem[]> {
    const portal = this.portal() ?? (await this.getPortal());
    const result: PortalQueryResult<object> = await portal.queryItems(query);
    const items: PortalItem[] = result.results as PortalItem[];
    return items;
  }
}
