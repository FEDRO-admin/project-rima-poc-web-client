import { inject, Injectable, signal, Signal } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import SceneView from '@arcgis/core/views/SceneView';
import Layer from '@arcgis/core/layers/Layer';
import { ViewStore } from './view.store';
import { MapViewService } from './mapview/mapview.service';
import { SceneViewService } from './sceneview/sceneview.service';

export type RimaView = MapView | SceneView;

@Injectable({
  providedIn: 'root',
})
export class ViewService {
  public readonly activeView: Signal<RimaView | undefined>;
  private readonly writableActiveView = signal<RimaView | undefined>(undefined);

  private readonly viewStore = inject(ViewStore);
  private readonly mapViewInitService = inject(MapViewService);
  private readonly sceneViewInitService = inject(SceneViewService);

  private sceneLayers3DLoaded = false;

  constructor() {
    this.activeView = this.writableActiveView.asReadonly();
  }

  setInitialView(mapView: MapView): void {
    this.writableActiveView.set(mapView);
  }

  async switchToScene(): Promise<void> {
    const mapView = this.mapViewInitService.getMapView();
    const sceneView = this.sceneViewInitService.getSceneView();
    if (!mapView?.map || !sceneView?.map) return;

    this.viewStore.setMode('scene');
    this.writableActiveView.set(sceneView);

    await sceneView.when();

    if (mapView.extent) {
      await sceneView.goTo(mapView.extent, { animate: false });
    }

    if (!this.sceneLayers3DLoaded) {
      await this.sceneViewInitService.add3DLayers(sceneView.map);
      this.sceneLayers3DLoaded = true;
    }
  }

  async switchToMap(): Promise<void> {
    const mapView = this.mapViewInitService.getMapView();
    const sceneView = this.sceneViewInitService.getSceneView();
    if (!mapView?.map || !sceneView?.map) return;

    this.viewStore.setMode('map');
    this.writableActiveView.set(mapView);

    if (sceneView.extent) {
      await mapView.goTo(sceneView.extent, { animate: false });
    }
  }

  addLayers(layers: Layer[]): void {
    const view = this.writableActiveView();
    if (!view?.map) return;
    view.map.addMany(layers);
  }

  removeAllOperationalLayers(): void {
    const view = this.writableActiveView();
    if (!view?.map) return;
    view.map.layers.removeAll();
  }
}
