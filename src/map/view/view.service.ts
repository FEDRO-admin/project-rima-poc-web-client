import { Injectable, signal, Signal } from '@angular/core';
import MapView from '@arcgis/core/views/MapView';
import SceneView from '@arcgis/core/views/SceneView';
import { MapViewAlreadyRegisteredError } from '../map-errors';
import { RIMA_SWISSTOPO_WMTS_URL, RIMA_SWISSTOPO_BASEMAP_LAYER_ID } from '../map-constants';
import Basemap from '@arcgis/core/Basemap';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';

export type RimaView = MapView | SceneView;

@Injectable({
  providedIn: 'root',
})
export class MapViewService {
  public readonly mapView: Signal<RimaView | undefined>;
  private readonly writableMapView = signal<RimaView | undefined>(undefined);

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

  public switchToScene(): void {
    if (!this._sceneView) throw new Error('Scene view not registered');
    this.writableMapView.set(this._sceneView);
  }

  public switchToMap(): void {
    if (!this._mapView) throw new Error('Map view not registered');
    this.writableMapView.set(this._mapView);
  }

  public getMapView(): MapView | undefined {
    return this._mapView;
  }

  public getSceneView(): SceneView | undefined {
    return this._sceneView;
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
}
