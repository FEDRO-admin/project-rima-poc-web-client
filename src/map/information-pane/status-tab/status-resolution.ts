import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type { RimaView } from '../../view/view.service';
import { AttributeEditField } from '../../shared/attribute-edit-field';
import { isImmutableField } from '../../layer/layer-attributes';
import { buildEditAttributeField } from '../../layer/layer-attribute-domain-resolver';
import { StatusRecord } from './status-types';
import { STATUS_LAYER_ID, STATUS_AUTO_POPULATED_FIELDS } from './status-config';

export function findStatusRelationshipId(layer: FeatureLayer): number | undefined {
  return layer.relationships?.find((rel) => rel.role === 'origin' && rel.relatedTableId === STATUS_LAYER_ID)?.id;
}

export function findStatusLayer(view: RimaView): FeatureLayer | undefined {
  return view.map?.allLayers.find((l) => l instanceof FeatureLayer && l.layerId === STATUS_LAYER_ID) as
    | FeatureLayer
    | undefined;
}

export function resolveStatusEditableFields(layer: FeatureLayer): AttributeEditField[] {
  if (!layer.fields?.length) return [];

  return layer.fields
    .filter(
      (field) =>
        !isImmutableField(field.name, layer) && !STATUS_AUTO_POPULATED_FIELDS.includes(field.name.toLowerCase()),
    )
    .map((field) => buildEditAttributeField(field));
}

export async function queryStatusRecord(
  layer: FeatureLayer,
  graphic: Graphic,
  relationshipId: number,
  statusLayer: FeatureLayer,
  historicMoment?: Date,
): Promise<StatusRecord | undefined> {
  const objectId = graphic.attributes[layer.objectIdField];
  if (objectId == null) return undefined;

  const query = new RelationshipQuery({
    objectIds: [objectId],
    relationshipId,
    outFields: ['*'],
    returnGeometry: false,
    historicMoment: historicMoment ?? undefined,
  });

  const result = await layer.queryRelatedFeatures(query);
  const featureSet = result[objectId];
  if (!featureSet?.features?.length) return undefined;

  return graphicToStatusRecord(featureSet.features[0], statusLayer);
}

function graphicToStatusRecord(graphic: Graphic, statusLayer: FeatureLayer): StatusRecord {
  return {
    objectId: graphic.attributes[statusLayer.objectIdField],
    globalId: graphic.attributes.globalid ?? undefined,
    attributes: { ...graphic.attributes },
    isNew: false,
    isModified: false,
  };
}
