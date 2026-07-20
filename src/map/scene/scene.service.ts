import { inject, Injectable } from '@angular/core';
import type ArcGISMap from '@arcgis/core/Map';
import { SceneStore } from './scene.store';
import { SceneLayerService } from './scene-layer.service';
import { MapViewService } from '../view/view.service';

@Injectable({
  providedIn: 'root',
})
export class SceneService {
  private readonly sceneStore = inject(SceneStore);
  private readonly viewService = inject(MapViewService);
  private readonly sceneLayerService = inject(SceneLayerService);

  async switchTo3D(): Promise<void> {
    const mapView = this.viewService.getMapView();
    const sceneView = this.viewService.getSceneView();
    if (!mapView?.map || !sceneView?.map) return;

    this.transferLayers(mapView.map, sceneView.map);
    this.sceneStore.setMode('3d');
    this.viewService.switchToScene();

    await sceneView.when();

    if (mapView.extent) {
      await sceneView.goTo(mapView.extent, { animate: false });
    }

    await this.add3DLayers(sceneView.map);
  }

  async switchTo2D(): Promise<void> {
    const mapView = this.viewService.getMapView();
    const sceneView = this.viewService.getSceneView();
    if (!mapView?.map || !sceneView?.map) return;

    this.remove3DLayers(sceneView.map);
    this.transferLayers(sceneView.map, mapView.map);
    this.sceneStore.setMode('2d');
    this.viewService.switchToMap();

    if (sceneView.extent) {
      await mapView.goTo(sceneView.extent, { animate: false });
    }
  }

  private async add3DLayers(map: ArcGISMap): Promise<void> {
    this.sceneStore.setSceneLayersLoadState('loading');
    try {
      const layers = await this.sceneLayerService.load3DLayers();
      map.layers.addMany(layers);
      this.sceneStore.setSceneLayersLoadState('loaded');
    } catch {
      this.sceneStore.setSceneLayersLoadState('error');
    }
  }

  private remove3DLayers(map: ArcGISMap): void {
    const layersToRemove = map.layers.filter((layer) => this.sceneLayerService.isSceneLayer(layer));
    map.layers.removeMany(layersToRemove.toArray());
  }

  private transferLayers(source: ArcGISMap, target: ArcGISMap): void {
    const layers = source.layers.toArray();
    source.layers.removeAll();
    target.layers.addMany(layers);
  }
}
