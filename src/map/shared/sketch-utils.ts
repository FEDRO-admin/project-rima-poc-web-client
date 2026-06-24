import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import FeatureSnappingLayerSource from '@arcgis/core/views/interactive/snapping/FeatureSnappingLayerSource';
import type Map from '@arcgis/core/Map';
import type SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import type GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type MapView from '@arcgis/core/views/MapView';

export function buildSnappingSources(map: Map): FeatureSnappingLayerSource[] {
  const sources: FeatureSnappingLayerSource[] = [];
  map.allLayers.forEach((layer) => {
    if (layer instanceof FeatureLayer) {
      sources.push(new FeatureSnappingLayerSource({ layer, enabled: true }));
    }
  });
  return sources;
}

export interface UndoRedoTarget {
  setUndoRedo(canUndo: boolean, canRedo: boolean): void;
}

export function updateUndoRedoState(sketchViewModel: SketchViewModel | undefined, store: UndoRedoTarget): void {
  store.setUndoRedo(sketchViewModel?.canUndo() ?? false, sketchViewModel?.canRedo() ?? false);
}

export function cleanupSketchResources(
  sketchViewModel: SketchViewModel | undefined,
  sketchLayer: GraphicsLayer | undefined,
  view: MapView | undefined,
): { sketchViewModel: undefined; sketchLayer: undefined } {
  if (sketchViewModel) {
    sketchViewModel.cancel();
    sketchViewModel.destroy();
  }

  if (sketchLayer) {
    if (view?.map) {
      view.map.remove(sketchLayer);
    }
    sketchLayer.destroy();
  }

  return { sketchViewModel: undefined, sketchLayer: undefined };
}
