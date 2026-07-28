import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type Relationship from '@arcgis/core/layers/support/Relationship';
import type Point from '@arcgis/core/geometry/Point';
import type MapView from '@arcgis/core/views/MapView';
import { AttributeEditField, convertAttributeFieldType } from '../shared/attribute-edit-field';
import { isImmutableField } from '../layer/layer-attributes';
import { ReferencePoint, ReferencePointRelationshipInfo, classifyRelationshipName } from './reference-point-types';
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

    const type = classifyRelationshipName(relatedLayer.title ?? '');
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

  return featureSet.features.map((feature: Graphic) => graphicToReferencePoint(feature));
}

function graphicToReferencePoint(graphic: Graphic): ReferencePoint {
  const layer = graphic.layer as FeatureLayer | undefined;
  return {
    objectId: layer ? graphic.attributes[layer.objectIdField] : graphic.attributes.objectid,
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
    .filter((field) => !isImmutableField(field.name, layer))
    .filter((field) => !REF_POINT_AUTO_POPULATED_FIELDS.includes(field.name.toLowerCase()))
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

function extractCodedValues(field: {
  domain?: { type?: string; codedValues?: { code: string | number; name: string }[] } | null;
}): { code: string | number; name: string }[] {
  if (field.domain?.type === 'coded-value' && field.domain.codedValues) {
    return field.domain.codedValues.map((cv) => ({ code: cv.code, name: cv.name }));
  }
  return [];
}

function findLayerByRelationship(relationship: Relationship, view: MapView): FeatureLayer | undefined {
  const allLayers = view.map!.allLayers;
  return allLayers.find((l) => {
    if (!(l instanceof FeatureLayer)) return false;
    return l.layerId === relationship.relatedTableId;
  }) as FeatureLayer | undefined;
}
