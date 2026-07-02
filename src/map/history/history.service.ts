import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import TimeExtent from '@arcgis/core/time/TimeExtent';
import { MapViewService } from '../view/view.service';
import { HistoryStore } from './history.store';

@Injectable({
  providedIn: 'root',
})
export class HistoryService {
  private readonly viewService = inject(MapViewService);
  private readonly historyStore = inject(HistoryStore);

  async initialize(): Promise<void> {
    const layers = this.getFeatureLayers();
    if (layers.length === 0) return;

    await Promise.all(layers.map((l) => l.load()));

    const fullTimeExtent = new TimeExtent({
      start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      end: new Date(),
    });

    this.historyStore.setFullTimeExtent(fullTimeExtent);
  }

  applyHistoricMoment(date: Date): void {
    const layers = this.getFeatureLayers();
    for (const layer of layers) {
      layer.historicMoment = date;
    }
  }

  clearHistoricMoment(): void {
    const layers = this.getFeatureLayers();
    for (const layer of layers) {
      layer.historicMoment = null;
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
