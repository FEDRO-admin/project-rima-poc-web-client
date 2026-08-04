import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type Field from '@arcgis/core/layers/support/Field';
import type Point from '@arcgis/core/geometry/Point';
import type MapView from '@arcgis/core/views/MapView';
import { AttributeEditField, convertAttributeFieldType } from '../shared/attribute-edit-field';
import { isImmutableField } from '../layer/layer-attributes';
import { ReferencePoint, ReferencePointType, generateClientId } from './reference-point-types';
import { REF_POINT_AUTO_POPULATED_FIELDS, REF_POINT_TYPE_CONFIGS } from './reference-point-config';

export function findRelationshipId(layer: FeatureLayer, type: ReferencePointType): number | undefined {
  const config = REF_POINT_TYPE_CONFIGS[type];
  return layer.relationships?.find((rel) => rel.role === 'origin' && rel.relatedTableId === config.layerId)?.id;
}

export function findRelatedLayer(view: MapView, type: ReferencePointType): FeatureLayer | undefined {
  const config = REF_POINT_TYPE_CONFIGS[type];
  return view.map?.allLayers.find((l) => l instanceof FeatureLayer && l.layerId === config.layerId) as
    | FeatureLayer
    | undefined;
}

export function resolveEditableFields(layer: FeatureLayer): AttributeEditField[] {
  if (!layer.fields?.length) return [];

  return layer.fields
    .filter(
      (field) =>
        !isImmutableField(field.name, layer) && !REF_POINT_AUTO_POPULATED_FIELDS.includes(field.name.toLowerCase()),
    )
    .map((field) => ({
      name: field.name,
      alias: field.alias || field.name,
      fieldType: convertAttributeFieldType(field),
      nullable: field.nullable,
      length: field.length ?? undefined,
      codedValues: extractCodedValues(field),
      editable: field.editable,
    }));
}

export async function queryRelatedPoints(
  layer: FeatureLayer,
  graphic: Graphic,
  relationshipId: number,
  relatedLayer: FeatureLayer,
  historicMoment?: Date,
): Promise<ReferencePoint[]> {
  const objectId = graphic.attributes[layer.objectIdField];
  if (objectId == null) return [];

  const query = new RelationshipQuery({
    objectIds: [objectId],
    relationshipId,
    outFields: ['*'],
    returnGeometry: true,
    historicMoment: historicMoment ?? undefined,
  });

  const result = await layer.queryRelatedFeatures(query);
  const featureSet = result[objectId];
  if (!featureSet?.features?.length) return [];

  return featureSet.features.map((feature: Graphic) => graphicToReferencePoint(feature, relatedLayer));
}

function graphicToReferencePoint(graphic: Graphic, relatedLayer: FeatureLayer): ReferencePoint {
  return {
    clientId: generateClientId(),
    objectId: graphic.attributes[relatedLayer.objectIdField],
    globalId: graphic.attributes.globalid ?? undefined,
    geometry: graphic.geometry as Point | undefined,
    attributes: { ...graphic.attributes },
    isNew: false,
    isModified: false,
  };
}

function extractCodedValues(field: Field): { code: string | number; name: string }[] {
  if (field.domain?.type === 'coded-value' && field.domain.codedValues) {
    return field.domain.codedValues.map((cv) => ({ code: cv.code, name: cv.name }));
  }
  return [];
}
