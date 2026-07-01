import { inject, Injectable, OnDestroy } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type Geometry from '@arcgis/core/geometry/Geometry';
import type MapView from '@arcgis/core/views/MapView';
import { EditStore } from './edit.store';
import { PopupStore } from '../popup/popup.store';
import { MapViewService } from '../view/view.service';
import { EditSaveError } from './edit-errors';
import { isImmutableField } from '../layer/layer-attributes';
import { EDIT_LINE_SYMBOL, EDIT_POINT_SYMBOL, EDIT_POLYGON_SYMBOL } from './edit-config';
import { buildSnappingSources, updateUndoRedoState, cleanupSketchResources } from '../shared/sketch-utils';
import { ReferencePointService } from '../shared/reference-point/reference-point.service';

type AttributeValue = string | number | boolean | null;
type SketchTool = 'move' | 'reshape' | 'transform';

@Injectable({
  providedIn: 'root',
})
export class EditService implements OnDestroy {
  private readonly store = inject(EditStore);
  private readonly popupStore = inject(PopupStore);
  private readonly viewService = inject(MapViewService);
  private readonly referencePointService = inject(ReferencePointService);

  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private sketchGraphic: Graphic | undefined;
  private eventHandle: { remove(): void } | undefined;

  private highlightLayer: GraphicsLayer | undefined;
  private highlightGraphic: Graphic | undefined;

  private _originalGeometry: Geometry | undefined;

  ngOnDestroy(): void {
    this.reset();
  }

  activate(graphic: Graphic): void {
    this.reset();
    this.store.activate(graphic);
    this.popupStore.close();
    this.showHighlight(graphic.geometry!);
    this.referencePointService.loadForFeature(graphic);
  }

  startGeometryEditing(): void {
    const graphic = this.store.graphic();
    const view = this.viewService.mapView();
    if (!view?.map || !graphic?.geometry) return;

    this._originalGeometry = graphic.geometry.clone();
    this.removeHighlight();
    this.activateSketch(view, graphic.geometry);
  }

  confirmGeometry(): void {
    this.deactivateSketch();
    const editedGeometry = this.store.editedGeometry();
    if (editedGeometry) {
      this.showHighlight(editedGeometry);
    }
  }

  discardGeometry(): void {
    this.deactivateSketch();
    this.store.clearGeometry();
    if (this._originalGeometry) {
      this.showHighlight(this._originalGeometry);
    }
    this._originalGeometry = undefined;
  }

  reenterSketch(): void {
    const graphic = this.store.graphic();
    const view = this.viewService.mapView();
    if (!view?.map || !graphic) return;

    const geometry = this.store.editedGeometry() ?? graphic.geometry;
    if (!geometry) return;

    this.removeHighlight();
    this.deactivateSketch();
    this.activateSketch(view, geometry);
  }

  async save(): Promise<void> {
    const graphic = this.store.graphic();
    if (!graphic) return;

    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    this.store.setSaving(true);

    try {
      this.deactivateSketch();
      this.removeHighlight();

      const objectIdField = layer.objectIdField;
      const objectId = graphic.attributes[objectIdField];

      const updateAttributes = this.buildUpdatePayload(graphic, this.store.editedAttributes());
      const editedGeometry = this.store.editedGeometry();

      const updateGraphic = new Graphic({
        attributes: updateAttributes,
        geometry: editedGeometry ?? undefined,
      });

      const result = await layer.applyEdits({ updateFeatures: [updateGraphic] });
      const updateResult = result.updateFeatureResults[0];

      if (updateResult?.error) {
        throw new EditSaveError(updateResult.error);
      }

      // Save reference points
      const parentId = graphic.attributes.id;
      if (parentId) {
        await this.referencePointService.saveAll(parentId);
      }

      layer.refresh();
      this.referencePointService.reset();
      this.store.reset();

      // Reopen popup with refreshed feature
      const query = layer.createQuery();
      query.objectIds = [objectId];
      query.outFields = ['*'];
      query.returnGeometry = true;

      const featureSet = await layer.queryFeatures(query);
      const refreshed = featureSet.features[0];
      if (refreshed) {
        this.popupStore.open([refreshed]);
      }
    } catch (error) {
      this.store.setSaving(false);
      if (error instanceof EditSaveError) {
        throw error;
      }
      throw new EditSaveError(error);
    }
  }

  cancel(): void {
    const graphic = this.store.graphic();
    this.reset();

    // Reopen popup with the original graphic
    if (graphic) {
      this.popupStore.open([graphic]);
    }
  }

  reset(): void {
    this.deactivateSketch();
    this.removeHighlight();
    this._originalGeometry = undefined;
    this.referencePointService.reset();
    this.store.reset();
  }

  undo(): void {
    this.sketchViewModel?.undo();
    updateUndoRedoState(this.sketchViewModel, this.store);
  }

  redo(): void {
    this.sketchViewModel?.redo();
    updateUndoRedoState(this.sketchViewModel, this.store);
  }

  private activateSketch(view: MapView, geometry: Geometry): void {
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
        this.onSketchComplete();
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
    this.store.setSketchActive(true);
  }

  private deactivateSketch(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;
    this.sketchGraphic = undefined;

    const view = this.viewService.mapView();
    const cleaned = cleanupSketchResources(this.sketchViewModel, this.sketchLayer, view);
    this.sketchViewModel = cleaned.sketchViewModel;
    this.sketchLayer = cleaned.sketchLayer;

    this.store.deactivateSketch();
  }

  private onSketchComplete(): void {
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

  private showHighlight(geometry: Geometry): void {
    const view = this.viewService.mapView();
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

  private removeHighlight(): void {
    const view = this.viewService.mapView();
    if (this.highlightLayer && view?.map) {
      view.map.remove(this.highlightLayer);
    }
    this.highlightLayer = undefined;
    this.highlightGraphic = undefined;
  }

  private buildUpdatePayload(
    graphic: Graphic,
    editedAttributes: Record<string, AttributeValue>,
  ): Record<string, AttributeValue> {
    const layer = graphic.layer as FeatureLayer;
    const payload: Record<string, AttributeValue> = {};
    const objectIdField = layer.objectIdField;

    // Always include the object ID
    payload[objectIdField] = graphic.attributes[objectIdField];

    // Include only mutable fields
    for (const [key, value] of Object.entries(editedAttributes)) {
      if (!isImmutableField(key, layer) && key !== objectIdField) {
        payload[key] = value;
      }
    }

    return payload;
  }

  private getToolForGeometryType(geometryType: string): SketchTool {
    switch (geometryType) {
      case 'point':
      case 'multipoint':
        return 'move';
      default:
        return 'reshape';
    }
  }

  private getEditSymbol(
    geometryType: string,
  ): typeof EDIT_POINT_SYMBOL | typeof EDIT_LINE_SYMBOL | typeof EDIT_POLYGON_SYMBOL {
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
