import { inject, Injectable, OnDestroy } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type Geometry from '@arcgis/core/geometry/Geometry';
import type { RimaView } from '../view/view.service';
import { EditStore } from './edit.store';
import { PopupService } from '../information-pane/popup.service';
import { ViewStore } from '../view/view.store';
import { ViewService } from '../view/view.service';
import { EditSaveError } from './edit-errors';
import { isImmutableField } from '../layer/layer-attributes';
import { EDIT_LINE_SYMBOL, EDIT_POINT_SYMBOL, EDIT_POLYGON_SYMBOL } from './edit-config';
import { buildSnappingSources, updateUndoRedoState, cleanupSketchResources } from '../shared/sketch-utils';

type AttributeValue = string | number | boolean | null;
type SketchTool = 'move' | 'reshape' | 'transform';

@Injectable({
  providedIn: 'root',
})
export class EditService implements OnDestroy {
  private readonly store = inject(EditStore);
  private readonly viewStore = inject(ViewStore);
  private readonly popupService = inject(PopupService);
  private readonly viewService = inject(ViewService);

  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private sketchGraphic: Graphic | undefined;
  private eventHandle: { remove(): void } | undefined;

  private highlightLayer: GraphicsLayer | undefined;
  private highlightGraphic: Graphic | undefined;

  private _originalGeometry: Geometry | undefined;

  ngOnDestroy(): void {
    this.store.reset();
  }

  activate(graphic: Graphic): void {
    this.cleanup();
    this.viewStore.setInteractionMode('editing');
    this.store.activate(graphic);
    this.showHighlight(graphic.geometry!);
  }

  startGeometryEditing(): void {
    const graphic = this.store.graphic();
    const view = this.viewService.activeView();
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
    const view = this.viewService.activeView();
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

    this.viewStore.setSaving(true);

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

      layer.refresh();
      this.viewStore.setSaving(false);
      this.store.reset();

      await this.popupService.refreshSelectedGraphic();
    } catch (error) {
      this.viewStore.setSaving(false);
      if (error instanceof EditSaveError) {
        throw error;
      }
      throw new EditSaveError(error);
    }
  }

  cancel(): void {
    this.cleanup();
  }

  cleanup(): void {
    this.deactivateSketch();
    this.removeHighlight();
    this._originalGeometry = undefined;
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

  private activateSketch(view: RimaView, geometry: Geometry): void {
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
    this.viewStore.setSketchActive(true);
  }

  private deactivateSketch(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;
    this.sketchGraphic = undefined;

    const view = this.viewService.activeView();
    const cleaned = cleanupSketchResources(this.sketchViewModel, this.sketchLayer, view);
    this.sketchViewModel = cleaned.sketchViewModel;
    this.sketchLayer = cleaned.sketchLayer;

    this.viewStore.setSketchActive(false);
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

  private removeHighlight(): void {
    const view = this.viewService.activeView();
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
