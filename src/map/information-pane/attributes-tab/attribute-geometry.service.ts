import { inject, Injectable, OnDestroy } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type Geometry from '@arcgis/core/geometry/Geometry';
import type { CreateTool } from '@arcgis/core/widgets/Sketch/types';
import type { RimaView } from '../../view/view.service';
import { ViewService } from '../../view/view.service';
import { ViewStore } from '../../view/view.store';
import { AttributeEditStore } from './attribute-edit.store';
import { getDefaultCreateTool, EDIT_POINT_SYMBOL, EDIT_LINE_SYMBOL, EDIT_POLYGON_SYMBOL } from './attributes-config';
import { buildSnappingSources, updateUndoRedoState, cleanupSketchResources } from '../../shared/sketch-utils';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';

type SketchTool = 'move' | 'reshape' | 'transform';

@Injectable({
  providedIn: 'root',
})
export class AttributeGeometryService implements OnDestroy {
  private readonly viewService = inject(ViewService);
  private readonly viewStore = inject(ViewStore);
  private readonly store = inject(AttributeEditStore);

  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private sketchGraphic: Graphic | undefined;
  private eventHandle: { remove(): void } | undefined;
  private updateEventHandle: { remove(): void } | undefined;

  private highlightLayer: GraphicsLayer | undefined;
  private highlightGraphic: Graphic | undefined;

  private _originalGeometry: Geometry | undefined;

  ngOnDestroy(): void {
    this.cleanup();
  }

  // ── Edit mode: reshape existing geometry ──

  startEditing(): void {
    const graphic = this.store.graphic();
    const view = this.viewService.activeView();
    if (!view?.map || !graphic?.geometry) return;

    this._originalGeometry = graphic.geometry.clone();
    this.removeHighlight();
    this.activateEditSketch(view, graphic.geometry);
  }

  confirmGeometry(): void {
    this.cleanupSketch();
    const editedGeometry = this.store.editedGeometry();
    if (editedGeometry) {
      this.showHighlight(editedGeometry);
    }
  }

  discardGeometry(): void {
    this.cleanupSketch();
    this.store.clearGeometry();
    if (this._originalGeometry) {
      this.showHighlight(this._originalGeometry);
    }
    this._originalGeometry = undefined;
  }

  reenterEditSketch(): void {
    const graphic = this.store.graphic();
    const view = this.viewService.activeView();
    if (!view?.map || !graphic) return;

    const geometry = this.store.editedGeometry() ?? graphic.geometry;
    if (!geometry) return;

    this.removeHighlight();
    this.cleanupSketch();
    this.activateEditSketch(view, geometry);
  }

  // ── Create mode: draw new geometry ──

  startDrawing(layer: FeatureLayer, tool?: CreateTool): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.cleanupSketch();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    const createTool = tool ?? getDefaultCreateTool(layer.geometryType);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      pointSymbol: EDIT_POINT_SYMBOL,
      polylineSymbol: EDIT_LINE_SYMBOL,
      polygonSymbol: EDIT_POLYGON_SYMBOL,
      snappingOptions: {
        enabled: true,
        featureSources: buildSnappingSources(view.map),
      },
    });

    this.eventHandle = this.sketchViewModel.on('create', (event) => {
      if (event.state === 'active') {
        this.viewStore.setSketchActive(true);
      }
      if (event.state === 'complete' && event.graphic?.geometry) {
        this.sketchGraphic = event.graphic;
        this.store.updateGeometry(event.graphic.geometry);
        this.viewStore.setSketchActive(false);
        this.startAdjusting();
      }
      updateUndoRedoState(this.sketchViewModel, this.store);
    });

    this.sketchViewModel.create(createTool);
    this.viewStore.setSketchActive(true);
  }

  redraw(layer: FeatureLayer, tool?: CreateTool): void {
    this.cleanupSketch();
    this.store.clearGeometry();
    this.startDrawing(layer, tool);
  }

  confirmPlacement(): void {
    this.updateEventHandle?.remove();
    this.updateEventHandle = undefined;

    if (this.sketchViewModel) {
      this.sketchViewModel.cancel();
    }

    const geometry = this.sketchGraphic?.geometry;
    if (geometry) {
      this.store.updateGeometry(geometry);
    }
    this.store.setAdjusting(false);
  }

  reenterAdjusting(): void {
    if (!this.sketchViewModel || !this.sketchGraphic) return;
    this.store.setAdjusting(true);

    this.updateEventHandle = this.sketchViewModel.on('update', (event) => {
      if (event.state === 'active' || event.state === 'complete') {
        const updatedGeometry = event.graphics[0]?.geometry;
        if (updatedGeometry) {
          this.sketchGraphic = event.graphics[0];
          this.store.updateGeometry(updatedGeometry);
        }
      }
      if (event.state === 'complete') {
        this.reenterUpdate();
      }
      updateUndoRedoState(this.sketchViewModel, this.store);
    });

    const tool = this.getToolForGeometryType(this.sketchGraphic.geometry?.type ?? '');
    this.sketchViewModel.update(this.sketchGraphic, {
      tool,
      enableRotation: true,
      enableScaling: false,
      toggleToolOnClick: true,
      reshapeOptions: { edgeOperation: 'split', shapeOperation: 'move' },
    });
  }

  // ── Shared ──

  undo(): void {
    this.sketchViewModel?.undo();
    updateUndoRedoState(this.sketchViewModel, this.store);
  }

  redo(): void {
    this.sketchViewModel?.redo();
    updateUndoRedoState(this.sketchViewModel, this.store);
  }

  showHighlight(geometry: Geometry): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.removeHighlight();

    this.highlightLayer = new GraphicsLayer({ listMode: 'hide' });
    this.highlightGraphic = new Graphic({
      geometry,
      symbol: this.getEditSymbol(geometry.type),
    });
    this.highlightLayer.add(this.highlightGraphic);
    view.map.add(this.highlightLayer);
  }

  removeHighlight(): void {
    const view = this.viewService.activeView();
    if (this.highlightLayer && view?.map) {
      view.map.remove(this.highlightLayer);
    }
    this.highlightLayer = undefined;
    this.highlightGraphic = undefined;
  }

  cleanup(): void {
    this.cleanupSketch();
    this.removeHighlight();
    this._originalGeometry = undefined;
  }

  // ── Private ──

  private cleanupSketch(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;
    this.updateEventHandle?.remove();
    this.updateEventHandle = undefined;
    this.sketchGraphic = undefined;

    const view = this.viewService.activeView();
    const cleaned = cleanupSketchResources(this.sketchViewModel, this.sketchLayer, view);
    this.sketchViewModel = cleaned.sketchViewModel;
    this.sketchLayer = cleaned.sketchLayer;

    this.viewStore.setSketchActive(false);
    this.store.deactivateSketch();
  }

  private activateEditSketch(view: RimaView, geometry: Geometry): void {
    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map!.add(this.sketchLayer);

    this.sketchGraphic = new Graphic({
      geometry: geometry.clone(),
      symbol: this.getEditSymbol(geometry.type),
    });
    this.sketchLayer.add(this.sketchGraphic);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      updateOnGraphicClick: false,
      snappingOptions: {
        enabled: true,
        featureSources: buildSnappingSources(view.map!),
      },
    });

    this.eventHandle = this.sketchViewModel.on('update', (event) => {
      if (event.state === 'active' || event.state === 'complete') {
        const updatedGeometry = event.graphics[0]?.geometry;
        if (updatedGeometry) {
          this.store.updateGeometry(updatedGeometry);
        }
      }
      if (event.state === 'complete') {
        this.onEditSketchComplete();
      }
      updateUndoRedoState(this.sketchViewModel, this.store);
    });

    const tool = this.getToolForGeometryType(geometry.type);
    this.sketchViewModel.update(this.sketchGraphic, {
      tool,
      enableRotation: false,
      enableScaling: false,
      toggleToolOnClick: false,
      reshapeOptions: { edgeOperation: 'split', shapeOperation: 'move' },
    });
    this.viewStore.setSketchActive(true);
  }

  private onEditSketchComplete(): void {
    if (this.sketchViewModel && this.sketchGraphic) {
      const geometry = this.sketchGraphic.geometry;
      const tool = geometry ? this.getToolForGeometryType(geometry.type) : 'reshape';
      this.sketchViewModel.update(this.sketchGraphic, {
        tool,
        enableRotation: false,
        enableScaling: false,
        toggleToolOnClick: false,
        reshapeOptions: { edgeOperation: 'split', shapeOperation: 'move' },
      });
    }
  }

  private startAdjusting(): void {
    if (!this.sketchViewModel || !this.sketchGraphic) return;

    this.store.setAdjusting(true);

    this.updateEventHandle = this.sketchViewModel.on('update', (event) => {
      if (event.state === 'active' || event.state === 'complete') {
        const updatedGeometry = event.graphics[0]?.geometry;
        if (updatedGeometry) {
          this.sketchGraphic = event.graphics[0];
          this.store.updateGeometry(updatedGeometry);
        }
      }
      if (event.state === 'complete') {
        this.reenterUpdate();
      }
      updateUndoRedoState(this.sketchViewModel, this.store);
    });

    const tool = this.getToolForGeometryType(this.sketchGraphic.geometry?.type ?? '');
    this.sketchViewModel.update(this.sketchGraphic, {
      tool,
      enableRotation: true,
      enableScaling: false,
      toggleToolOnClick: true,
      reshapeOptions: { edgeOperation: 'split', shapeOperation: 'move' },
    });
  }

  private reenterUpdate(): void {
    if (this.sketchViewModel && this.sketchGraphic) {
      const tool = this.getToolForGeometryType(this.sketchGraphic.geometry?.type ?? '');
      this.sketchViewModel.update(this.sketchGraphic, {
        tool,
        enableRotation: true,
        enableScaling: false,
        toggleToolOnClick: true,
        reshapeOptions: { edgeOperation: 'split', shapeOperation: 'move' },
      });
    }
  }

  private getToolForGeometryType(type: string): SketchTool {
    return type === 'point' ? 'move' : 'reshape';
  }

  private getEditSymbol(geometryType: string): SimpleMarkerSymbol | SimpleLineSymbol | SimpleFillSymbol {
    switch (geometryType) {
      case 'point':
      case 'multipoint':
        return EDIT_POINT_SYMBOL;
      case 'polyline':
        return EDIT_LINE_SYMBOL;
      default:
        return EDIT_POLYGON_SYMBOL;
    }
  }
}
