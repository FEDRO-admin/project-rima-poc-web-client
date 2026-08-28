import { inject, Injectable } from '@angular/core';
import type Basemap from '@arcgis/core/Basemap';
import { PortalService } from '../../portal/portal.service';
import { BasemapLoadError, Default3DBasemapMissingError } from './basemap-errors';

@Injectable({
  providedIn: 'root',
})
export class BasemapService {
  private readonly portalService = inject(PortalService);

  async getDefault2DBasemap(): Promise<Basemap> {
    try {
      const portal = await this.portalService.getPortal();
      const basemap = portal.defaultBasemap;
      if (!basemap) throw new BasemapLoadError();
      return basemap;
    } catch (error) {
      if (error instanceof BasemapLoadError) throw error;
      throw new BasemapLoadError(error);
    }
  }

  async getDefault3DBasemap(): Promise<Basemap> {
    try {
      const portal = await this.portalService.getPortal();
      const basemap = await portal.fetchDefault3DBasemap();
      if (!basemap) throw new Default3DBasemapMissingError();
      return basemap;
    } catch (error) {
      if (error instanceof Default3DBasemapMissingError) throw error;
      throw new BasemapLoadError(error);
    }
  }
}
