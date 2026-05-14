import { Injectable } from '@angular/core';
import esriRequest from '@arcgis/core/request';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import LayerSearchSource from '@arcgis/core/widgets/Search/LayerSearchSource';
import { FEATURE_SERVER_URL } from './map-server.config';
import type { ResolvedLayer } from './resolved-layer';

interface FeatureLayerField {
  name: string;
  type: string;
}

interface FeatureLayerDetail {
  name: string;
  displayField: string;
  defaultVisibility: boolean;
  fields: FeatureLayerField[];
}

@Injectable({ providedIn: 'root' })
export class FeatureServerService {
  async resolveLayer(layerId: number): Promise<ResolvedLayer> {
    const response = await esriRequest(`${FEATURE_SERVER_URL}/${layerId}`, { query: { f: 'json' } });
    const detail = response.data as FeatureLayerDetail;

    const featureLayer = new FeatureLayer({
      url: `${FEATURE_SERVER_URL}/${layerId}`,
      visible: detail.defaultVisibility,
    });

    const stringFields = detail.fields
      .filter((field) => field.type === 'esriFieldTypeString')
      .map((field) => field.name);

    const searchSource =
      stringFields.length > 0
        ? new LayerSearchSource({
            layer: featureLayer,
            searchFields: stringFields,
            displayField: detail.displayField,
            name: detail.name.split('.').pop() ?? detail.name,
            exactMatch: false,
          })
        : undefined;

    return { featureLayer, searchSource };
  }
}
