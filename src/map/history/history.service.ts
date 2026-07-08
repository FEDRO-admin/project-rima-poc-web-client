import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SubtypeGroupLayer from '@arcgis/core/layers/SubtypeGroupLayer';
import { MapViewService } from '../view/view.service';
import { EditableLayer } from '../layer/editable-layer';

@Injectable({
  providedIn: 'root',
})
export class HistoryService {
  private readonly viewService = inject(MapViewService);

  applyHistoricMoment(date: Date): void {
    const layers = this.getEditableLayers();
    for (const layer of layers) {
      layer.historicMoment = date;
      layer.refresh();
    }
  }

  clearHistoricMoment(): void {
    const layers = this.getEditableLayers();
    for (const layer of layers) {
      layer.historicMoment = null;
      layer.refresh();
    }
  }

  private getEditableLayers(): EditableLayer[] {
    const view = this.viewService.mapView();
    if (!view?.map) return [];

    const layers: EditableLayer[] = [];
    view.map.allLayers.forEach((layer) => {
      if (layer instanceof FeatureLayer || layer instanceof SubtypeGroupLayer) {
        layers.push(layer);
      }
    });
    return layers;
  }
}
