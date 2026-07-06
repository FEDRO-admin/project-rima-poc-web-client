import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { MapViewService } from '../view/view.service';

@Injectable({
  providedIn: 'root',
})
export class HistoryService {
  private readonly viewService = inject(MapViewService);

  applyHistoricMoment(date: Date): void {
    const layers = this.getFeatureLayers();
    for (const layer of layers) {
      layer.historicMoment = date;
      layer.refresh();
    }
  }

  clearHistoricMoment(): void {
    const layers = this.getFeatureLayers();
    for (const layer of layers) {
      layer.historicMoment = null;
      layer.refresh();
    }
  }

  private getFeatureLayers(): FeatureLayer[] {
    const view = this.viewService.mapView();
    if (!view?.map) return [];

    const layers: FeatureLayer[] = [];
    view.map.allLayers.forEach((layer) => {
      if (layer instanceof FeatureLayer) {
        layers.push(layer);
      }
    });
    return layers;
  }
}
