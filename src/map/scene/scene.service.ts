import { inject, Injectable } from '@angular/core';
import type ArcGISMap from '@arcgis/core/Map';
import { SceneStore } from './scene.store';
import { MapViewService } from '../view/view.service';

@Injectable({
  providedIn: 'root',
})
export class SceneService {
  private readonly sceneStore = inject(SceneStore);
  private readonly viewService = inject(MapViewService);

  async switchTo3D(): Promise<void> {
    const mapView = this.viewService.getMapView();
    const sceneView = this.viewService.getSceneView();
    if (!mapView?.map || !sceneView?.map) return;

    this.transferLayers(mapView.map, sceneView.map);
    this.sceneStore.setMode('3d');
    this.viewService.switchToScene();

    if (mapView.extent) {
      await sceneView.goTo(mapView.extent, { animate: false });
    }
  }

  async switchTo2D(): Promise<void> {
    const mapView = this.viewService.getMapView();
    const sceneView = this.viewService.getSceneView();
    if (!mapView?.map || !sceneView?.map) return;

    this.transferLayers(sceneView.map, mapView.map);
    this.sceneStore.setMode('2d');
    this.viewService.switchToMap();

    if (sceneView.extent) {
      await mapView.goTo(sceneView.extent, { animate: false });
    }
  }

  private transferLayers(source: ArcGISMap, target: ArcGISMap): void {
    const layers = source.layers.toArray();
    source.layers.removeAll();
    target.layers.addMany(layers);
  }
}
