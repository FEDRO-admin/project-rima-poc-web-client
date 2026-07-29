import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type Field from '@arcgis/core/layers/support/Field';
import type Relationship from '@arcgis/core/layers/support/Relationship';
import type Point from '@arcgis/core/geometry/Point';
import type MapView from '@arcgis/core/views/MapView';
import { AttributeEditField, convertAttributeFieldType } from '../shared/attribute-edit-field';
import { isImmutableField } from '../layer/layer-attributes';
import {
  ReferencePoint,
  ReferencePointRelationshipInfo,
  classifyRelationshipByLayerId,
  generateClientId,
} from './reference-point-types';
import { REF_POINT_AUTO_POPULATED_FIELDS } from './reference-point-config';

export function resolveAllRelationships(
  layer: FeatureLayer,
  view: MapView | undefined,
): ReferencePointRelationshipInfo[] {
  if (!layer.relationships?.length || !view?.map) return [];

  const results: ReferencePointRelationshipInfo[] = [];

  for (const rel of layer.relationships) {
    if (rel.role !== 'origin') continue;

    const relatedLayer = findLayerByRelationship(rel, view);
    if (!relatedLayer) continue;

    const type = classifyRelationshipByLayerId(relatedLayer.layerId);
    if (!type) continue;

    const fields = resolveEditableFields(relatedLayer);
    results.push({ type, relationshipId: rel.id, relatedLayer, fields });
  }

  return results;
}

export async function queryRelatedPoints(
  layer: FeatureLayer,
  graphic: Graphic,
  relationshipId: number,
  relatedLayer: FeatureLayer,
): Promise<ReferencePoint[]> {
  const objectId = graphic.attributes[layer.objectIdField];
  if (objectId == null) return [];

  const query = new RelationshipQuery({
    objectIds: [objectId],
    relationshipId,
    outFields: ['*'],
    returnGeometry: true,
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

function resolveEditableFields(layer: FeatureLayer): AttributeEditField[] {
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

function extractCodedValues(field: Field): { code: string | number; name: string }[] {
  if (field.domain?.type === 'coded-value' && field.domain.codedValues) {
    return field.domain.codedValues.map((cv) => ({ code: cv.code, name: cv.name }));
  }
  return [];
}

function findLayerByRelationship(relationship: Relationship, view: MapView): FeatureLayer | undefined {
  const allLayers = view.map!.allLayers;
  return allLayers.find((layer) => {
    if (!(layer instanceof FeatureLayer)) return false;
    return layer.layerId === relationship.relatedTableId;
  }) as FeatureLayer | undefined;
}
