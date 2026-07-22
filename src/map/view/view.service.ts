import { inject, Injectable, signal, Signal } from '@angular/core';
import type ArcGISMap from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import SceneView from '@arcgis/core/views/SceneView';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import Ground from '@arcgis/core/Ground';
import ElevationLayer from '@arcgis/core/layers/ElevationLayer';
import WMSLayer from '@arcgis/core/layers/WMSLayer';
import { MapViewAlreadyRegisteredError } from '../map-errors';
import {
  RIMA_SWISSTOPO_WMTS_URL,
  RIMA_SWISSTOPO_BASEMAP_LAYER_ID,
  RIMA_SPATIAL_REFERENCE_LV95_EPSG,
  RIMA_SWITZERLAND_EXTENT,
} from '../map-constants';
import { RIMA_SCENE_CONFIG } from './scene-config';
import Basemap from '@arcgis/core/Basemap';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import { ViewStore } from './view.store';
import { SceneLayerService } from './scene-layer.service';

export type RimaView = MapView | SceneView;

@Injectable({
  providedIn: 'root',
})
export class MapViewService {
  public readonly mapView: Signal<RimaView | undefined>;
  private readonly writableMapView = signal<RimaView | undefined>(undefined);

  private readonly viewStore = inject(ViewStore);
  private readonly sceneLayerService = inject(SceneLayerService);

  private _mapView: MapView | undefined;
  private _sceneView: SceneView | undefined;

  constructor() {
    this.mapView = this.writableMapView.asReadonly();
  }

  public async registerMapView(mapView: MapView): Promise<void> {
    if (this._mapView) throw new MapViewAlreadyRegisteredError();
    this._mapView = mapView;
    this.writableMapView.set(mapView);
  }

  public registerSceneView(sceneView: SceneView): void {
    this._sceneView = sceneView;
  }

  public getMapView(): MapView | undefined {
    return this._mapView;
  }

  public getSceneView(): SceneView | undefined {
    return this._sceneView;
  }

  async switchTo3D(): Promise<void> {
    const mapView = this._mapView;
    const sceneView = this._sceneView;
    if (!mapView?.map || !sceneView?.map) return;

    this.transferLayers(mapView.map, sceneView.map);
    this.viewStore.setMode('3d');
    this.writableMapView.set(sceneView);

    await sceneView.when();

    if (mapView.extent) {
      await sceneView.goTo(mapView.extent, { animate: false });
    }

    await this.add3DLayers(sceneView.map);
  }

  async switchTo2D(): Promise<void> {
    const mapView = this._mapView;
    const sceneView = this._sceneView;
    if (!mapView?.map || !sceneView?.map) return;

    this.remove3DLayers(sceneView.map);
    this.transferLayers(sceneView.map, mapView.map);
    this.viewStore.setMode('2d');
    this.writableMapView.set(mapView);

    if (sceneView.extent) {
      await mapView.goTo(sceneView.extent, { animate: false });
    }
  }

  public addBasemap(): void {
    const view = this._mapView;
    if (!view) throw new Error('Map view not registered');
    if (!view.map) throw new Error('Map view has no map');

    const swisstopoLayer = new WMTSLayer({
      url: RIMA_SWISSTOPO_WMTS_URL,
      activeLayer: { id: RIMA_SWISSTOPO_BASEMAP_LAYER_ID },
    });

    view.map.basemap = new Basemap({
      baseLayers: [swisstopoLayer],
      title: 'Swisstopo Pixelkarte',
      id: 'swisstopo',
    });
  }

  public configureSceneView(): void {
    const sceneView = this._sceneView;
    if (!sceneView) throw new Error('Scene view not registered');
    if (!sceneView.map) throw new Error('Scene view has no map');

    sceneView.spatialReference = new SpatialReference({ wkid: RIMA_SPATIAL_REFERENCE_LV95_EPSG });
    sceneView.clippingArea = RIMA_SWITZERLAND_EXTENT;

    const basemapLayer = new WMSLayer({
      url: RIMA_SCENE_CONFIG.basemap.wmsUrl,
      sublayers: [{ name: RIMA_SCENE_CONFIG.basemap.sublayer }],
      spatialReference: new SpatialReference({ wkid: RIMA_SPATIAL_REFERENCE_LV95_EPSG }),
    });

    sceneView.map.basemap = new Basemap({
      baseLayers: [basemapLayer],
      title: RIMA_SCENE_CONFIG.basemap.title,
      id: 'scene-basemap',
    });

    if (RIMA_SCENE_CONFIG.elevation.url) {
      sceneView.map.ground = new Ground({
        layers: [
          new ElevationLayer({
            url: RIMA_SCENE_CONFIG.elevation.url,
          }),
        ],
      });
    }
  }

  private async add3DLayers(map: ArcGISMap): Promise<void> {
    try {
      const layers = await this.sceneLayerService.load3DLayers();
      map.layers.addMany(layers);
    } catch {
      // Scene layer load failure is non-fatal — 3D view still usable without extra layers
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
