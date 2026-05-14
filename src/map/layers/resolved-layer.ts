import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import LayerSearchSource from '@arcgis/core/widgets/Search/LayerSearchSource';

export interface ResolvedLayer {
  featureLayer: FeatureLayer;
  searchSource?: LayerSearchSource;
}
