import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { RimaLayerConfig } from '../rima-layer';

// test layer definition..
export const achsenLayer: RimaLayerConfig = {
  layer: new FeatureLayer({
    url: 'https://rima-poc.switzerlandnorth.cloudapp.azure.com/arcgis/rest/services/NewFolder/Achsen_Test2/FeatureServer',
  }),
  search: {
    searchFields: ['OBJECTID', 'NAME'],
    displayField: 'NAME',
    name: 'Achsen',
    exactMatch: false,
  },
};
