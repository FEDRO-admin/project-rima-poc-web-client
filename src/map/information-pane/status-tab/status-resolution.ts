import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type { RimaView } from '../../view/view.service';
import { AttributeEditField } from '../../shared/attribute-edit-field';
import { isImmutableField } from '../../layer/layer-attributes';
import { buildEditAttributeField } from '../../layer/layer-attribute-domain-resolver';
import { StatusRecord } from './status-types';
import { STATUS_AUTO_POPULATED_FIELDS, BEWERTUNGSDATUM_FIELD } from './status-config';

export function findStatusRelationshipId(layer: FeatureLayer, layerId: number): number | undefined {
  return layer.relationships?.find((rel) => rel.role === 'origin' && rel.relatedTableId === layerId)?.id;
}

export function findStatusLayer(view: RimaView, layerId: number): FeatureLayer | undefined {
  return view.map?.allLayers.find((l) => l instanceof FeatureLayer && l.layerId === layerId) as
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

export async function queryStatusRecords(
  layer: FeatureLayer,
  graphic: Graphic,
  relationshipId: number,
  statusLayer: FeatureLayer,
  historicMoment?: Date,
): Promise<StatusRecord[]> {
  const objectId = graphic.attributes[layer.objectIdField];
  if (objectId == null) return [];

  const query = new RelationshipQuery({
    objectIds: [objectId],
    relationshipId,
    outFields: ['*'],
    returnGeometry: false,
    historicMoment: historicMoment ?? undefined,
  });

  const result = await layer.queryRelatedFeatures(query);
  const featureSet = result[objectId];
  if (!featureSet?.features?.length) return [];

  const records = featureSet.features.map((feature: Graphic) => graphicToStatusRecord(feature, statusLayer));
  return sortByBewertungsdatum(records);
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

function sortByBewertungsdatum(records: StatusRecord[]): StatusRecord[] {
  return records.sort((a, b) => {
    const dateA = a.attributes[BEWERTUNGSDATUM_FIELD];
    const dateB = b.attributes[BEWERTUNGSDATUM_FIELD];
    if (dateA == null && dateB == null) return 0;
    if (dateA == null) return 1;
    if (dateB == null) return -1;
    return dateA > dateB ? -1 : dateA < dateB ? 1 : 0;
  });
}
