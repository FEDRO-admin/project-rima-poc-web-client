import type { FeatureLayerProperties } from '@arcgis/core/layers/FeatureLayer';
import type { LayerSearchSourceProperties } from '@arcgis/core/widgets/Search/LayerSearchSource';

export interface RimaLayerConfig {
  layer: FeatureLayerProperties;
  search?: Omit<LayerSearchSourceProperties, 'layer'>;
}
