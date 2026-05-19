import { Injectable, signal, Signal } from '@angular/core';
import WebMap from '@arcgis/core/WebMap';
import { RIMA_PORTAL_URL, RIMA_WEB_MAP_ITEM_ID } from '../map.constants';
import Portal from '@arcgis/core/portal/Portal';
import { WebMapLoadError } from '../map.error';

@Injectable({
  providedIn: 'root',
})
export class WebmapService {
  public readonly webMap: Signal<WebMap | undefined>;
  private readonly writableWebMap = signal<WebMap | undefined>(undefined);
  private loadPromise: Promise<void> | undefined; // in case in-flight load, to prevent multiple loads

  constructor() {
    this.webMap = this.writableWebMap.asReadonly();
  }

  loadWebMap(): Promise<void> {
    if (this.webMap()) return Promise.resolve();

    // if left empty, then define as right.
    this.loadPromise ??= this.doLoad();
    return this.loadPromise;
  }

  private async doLoad(): Promise<void> {
    try {
      const webMap = new WebMap({
        portalItem: {
          id: RIMA_WEB_MAP_ITEM_ID,
          portal: new Portal({ url: RIMA_PORTAL_URL }),
        },
      });

      await webMap.load();
      this.writableWebMap.set(webMap);
    } catch (error) {
      this.loadPromise = undefined;
      throw new WebMapLoadError(error);
    }
  }
}
