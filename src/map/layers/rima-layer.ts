import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { LayerSearchSourceProperties } from '@arcgis/core/widgets/Search/LayerSearchSource';

// The layer configuration interface
// in the future we can add template etc..

export interface RimaLayerConfig {
  layer: FeatureLayer;
  search?: LayerSearchSourceProperties;
}
