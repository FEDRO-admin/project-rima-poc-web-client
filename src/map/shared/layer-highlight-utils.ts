import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { RimaView } from '../view/view.service';

interface HighlightableLayerView {
  highlight(target: number[]): { remove(): void };
}

export async function highlightFeatures(
  view: RimaView,
  layer: FeatureLayer,
  objectIds: number[],
): Promise<{ remove(): void } | undefined> {
  if (!objectIds.length) return undefined;

  const layerView = (await view.whenLayerView(layer)) as HighlightableLayerView;
  if (typeof layerView.highlight !== 'function') return undefined;

  return layerView.highlight(objectIds);
}
