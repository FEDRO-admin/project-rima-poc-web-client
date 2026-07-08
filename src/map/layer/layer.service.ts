import { inject, Injectable } from '@angular/core';
import { MapViewService } from '../view/view.service';

@Injectable({
  providedIn: 'root',
})
export class LayerService {
  private readonly viewService = inject(MapViewService);

  removeAllOperationalLayers(): void {
    const view = this.viewService.mapView();
    if (!view?.map) return;
    view.map.layers.removeAll();
  }
}
