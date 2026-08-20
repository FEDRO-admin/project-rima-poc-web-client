import GroupLayer from '@arcgis/core/layers/GroupLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Layer from '@arcgis/core/layers/Layer';
import type EsriMap from '@arcgis/core/Map';

export interface LayerActivationState {
  savedVisibility: { layer: Layer; visible: boolean }[];
  topLayer: Layer | undefined;
  previousIndex: number | undefined;
}

export function activateLayer(map: EsriMap, layerTitle: string): LayerActivationState {
  const state: LayerActivationState = { savedVisibility: [], topLayer: undefined, previousIndex: undefined };

  const layer = map.allLayers.find((l) => l instanceof FeatureLayer && l.title === layerTitle) as Layer | undefined;
  if (!layer) return state;

  saveAndActivate(layer, state);

  const topLayerParent = getTopLevelParent(layer, map);
  if (topLayerParent) {
    state.topLayer = topLayerParent;
    state.previousIndex = map.layers.indexOf(topLayerParent);
    map.reorder(topLayerParent, map.layers.length - 1);
  }

  return state;
}

export function deactivateLayer(map: EsriMap, state: LayerActivationState): void {
  if (!state.savedVisibility.length) return;

  if (state.topLayer && state.previousIndex !== undefined) {
    map.reorder(state.topLayer, state.previousIndex);
  }

  for (const entry of state.savedVisibility) {
    entry.layer.visible = entry.visible;
  }
}

function saveAndActivate(layer: Layer, state: LayerActivationState): void {
  state.savedVisibility.push({ layer, visible: layer.visible });
  layer.visible = true;

  const parent = layer.parent;
  if (parent instanceof GroupLayer) {
    saveAndActivate(parent, state);
  }
}

function getTopLevelParent(layer: Layer, map: EsriMap): Layer | undefined {
  let current: Layer = layer;
  while (current.parent instanceof GroupLayer) {
    current = current.parent;
  }
  return map.layers.includes(current) ? current : undefined;
}
