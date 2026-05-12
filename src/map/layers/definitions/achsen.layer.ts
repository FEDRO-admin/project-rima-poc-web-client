import { RimaLayerConfig } from '../rima-layer';

export const achsenLayer: RimaLayerConfig = {
  layer: {
    url: 'https://rima-poc.switzerlandnorth.cloudapp.azure.com/arcgis/rest/services/NewFolder/Achsen_Test2/FeatureServer',
  },
  search: {
    searchFields: ['OBJECTID', 'NAME'],
    displayField: 'NAME',
    name: 'Achsen',
    exactMatch: false,
  },
};
