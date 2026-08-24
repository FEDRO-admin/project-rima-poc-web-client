import { inject, Injectable, signal, Signal } from '@angular/core';
import type ArcGISMap from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import SceneView from '@arcgis/core/views/SceneView';
import Layer from '@arcgis/core/layers/Layer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import type Collection from '@arcgis/core/core/Collection';
import type ElevationInfo from '@arcgis/core/symbols/support/ElevationInfo';
import { ViewStore } from './view.store';
import { MapViewService } from './mapview/mapview.service';
import { SceneViewService } from './sceneview/sceneview.service';

export type RimaView = MapView | SceneView;

interface TransferredLayer {
  layer: FeatureLayer;
  originalParent: Collection<Layer>;
  originalIndex: number;
  originalElevationInfo: ElevationInfo | null | undefined;
  ancestorGroups: GroupLayer[];
}

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
  private transferredLayers: TransferredLayer[] = [];
  private mirrorGroupLayers: GroupLayer[] = [];

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

    this.transferLayersToScene(mapView.map, sceneView.map);
  }

  async switchToMap(): Promise<void> {
    const mapView = this.mapViewInitService.getMapView();
    const sceneView = this.sceneViewInitService.getSceneView();
    if (!mapView?.map || !sceneView?.map) return;

    this.transferLayersBackToMap(sceneView.map);

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

  private transferLayersToScene(mapMap: ArcGISMap, sceneMap: ArcGISMap): void {
    this.transferredLayers = this.collectZEnabledLayers(mapMap.layers, []);

    // Remove in reverse to preserve recorded indices within the same parent
    for (let i = this.transferredLayers.length - 1; i >= 0; i--) {
      const { layer, originalParent } = this.transferredLayers[i];
      originalParent.remove(layer);
      layer.elevationInfo = { mode: 'absolute-height' };
    }

    this.mirrorGroupLayers = this.buildMirrorTree(this.transferredLayers);
    sceneMap.layers.addMany(this.mirrorGroupLayers);
  }

  private transferLayersBackToMap(sceneMap: ArcGISMap): void {
    sceneMap.layers.removeMany(this.mirrorGroupLayers);
    this.mirrorGroupLayers = [];

    for (const { layer, originalParent, originalIndex, originalElevationInfo } of this.transferredLayers) {
      layer.elevationInfo = originalElevationInfo;
      const insertAt = Math.min(originalIndex, originalParent.length);
      originalParent.add(layer, insertAt);
    }

    this.transferredLayers = [];
  }

  private collectZEnabledLayers(layers: Collection<Layer>, ancestors: GroupLayer[]): TransferredLayer[] {
    const result: TransferredLayer[] = [];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers.getItemAt(i);
      if (layer instanceof FeatureLayer && layer.hasZ) {
        result.push({
          layer,
          originalParent: layers,
          originalIndex: i,
          originalElevationInfo: layer.elevationInfo,
          ancestorGroups: ancestors,
        });
      } else if (layer instanceof GroupLayer) {
        result.push(...this.collectZEnabledLayers(layer.layers, [...ancestors, layer]));
      }
    }

    return result;
  }

  private buildMirrorTree(transfers: TransferredLayer[]): GroupLayer[] {
    const mirrorMap = new Map<GroupLayer, GroupLayer>();
    const rootGroup = new GroupLayer();

    for (const { layer, ancestorGroups } of transfers) {
      let currentParent = rootGroup;

      for (const originalGroup of ancestorGroups) {
        let mirror = mirrorMap.get(originalGroup);
        if (!mirror) {
          mirror = new GroupLayer({ title: originalGroup.title, visibilityMode: originalGroup.visibilityMode });
          mirrorMap.set(originalGroup, mirror);
          currentParent.layers.add(mirror);
        }
        currentParent = mirror;
      }

      currentParent.layers.add(layer);
    }

    return rootGroup.layers.toArray() as GroupLayer[];
  }
}
