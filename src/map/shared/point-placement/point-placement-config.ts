import { InjectionToken } from '@angular/core';
import type SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';

export interface PointPlacementConfig {
  placingSymbol: SimpleMarkerSymbol;
}

export const POINT_PLACEMENT_CONFIG = new InjectionToken<PointPlacementConfig>('PointPlacementConfig');
