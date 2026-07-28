import { inject, Injectable } from '@angular/core';
import type ArcGISMap from '@arcgis/core/Map';
import SceneView from '@arcgis/core/views/SceneView';
import Layer from '@arcgis/core/layers/Layer';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Ground from '@arcgis/core/Ground';
import ElevationLayer from '@arcgis/core/layers/ElevationLayer';
import WMSLayer from '@arcgis/core/layers/WMSLayer';
import Basemap from '@arcgis/core/Basemap';
import { RIMA_SPATIAL_REFERENCE_LV95_EPSG, RIMA_SWITZERLAND_EXTENT } from '../../map-constants';
import { RIMA_SCENEVIEW_CONFIG } from './sceneview-config';
import { SceneViewInitialisationError } from './sceneview-errors';
import { SceneViewLayerService } from './sceneview-layer.service';

@Injectable({
  providedIn: 'root',
})
export class SceneViewService {
  private readonly sceneViewLayerService = inject(SceneViewLayerService);

  private _sceneView: SceneView | undefined;

  async init(sceneEl: HTMLArcgisSceneElement): Promise<void> {
    const sceneView = sceneEl.view;
    if (!sceneView) {
      throw new SceneViewInitialisationError('SceneView is not available on the arcgis-scene element');
    }

    this.registerSceneView(sceneView);
    this.configureSceneView();

    await sceneEl.viewOnReady();
  }

  getSceneView(): SceneView | undefined {
    return this._sceneView;
  }

  async add3DLayers(map: ArcGISMap): Promise<void> {
    try {
      const layers = await this.sceneViewLayerService.load3DLayers();
      map.layers.addMany(layers);
    } catch {
      // Scene layer load failure is non-fatal — 3D view still usable without extra layers
    }
  }

  isSceneLayer(layer: Layer): boolean {
    return this.sceneViewLayerService.isSceneLayer(layer);
  }

  private registerSceneView(sceneView: SceneView): void {
    this._sceneView = sceneView;
  }

  private configureSceneView(): void {
    const sceneView = this._sceneView;
    if (!sceneView) throw new Error('Scene view not registered');
    if (!sceneView.map) throw new Error('Scene view has no map');

    sceneView.spatialReference = new SpatialReference({ wkid: RIMA_SPATIAL_REFERENCE_LV95_EPSG });
    sceneView.clippingArea = RIMA_SWITZERLAND_EXTENT;

    const basemapLayer = new WMSLayer({
      url: RIMA_SCENEVIEW_CONFIG.basemap.wmsUrl,
      sublayers: [{ name: RIMA_SCENEVIEW_CONFIG.basemap.sublayer }],
      spatialReference: new SpatialReference({ wkid: RIMA_SPATIAL_REFERENCE_LV95_EPSG }),
    });

    sceneView.map.basemap = new Basemap({
      baseLayers: [basemapLayer],
      title: RIMA_SCENEVIEW_CONFIG.basemap.title,
      id: 'scene-basemap',
    });

    if (RIMA_SCENEVIEW_CONFIG.elevation.url) {
      sceneView.map.ground = new Ground({
        layers: [
          new ElevationLayer({
            url: RIMA_SCENEVIEW_CONFIG.elevation.url,
          }),
        ],
      });
    }
  }
}
