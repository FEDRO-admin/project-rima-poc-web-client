import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type Point from '@arcgis/core/geometry/Point';

import { ReferencePoint, ReferencePointType, generateClientId } from './reference-point-types';
import { REF_POINT_AUTO_POPULATED_FIELDS, REFERENCE_POINT_TYPES } from './reference-point-config';
import { REF_POINT_TYPE_FIELD, REF_POINT_MAP_LAYER_TITLE } from '../../map-config';
import { RimaView } from '../../view/view.service';
import { AttributeEditField } from '../../shared/attribute-edit-field';
import { isImmutableField } from '../../layer/layer-attributes';
import { buildEditAttributeField } from '../../layer/layer-attribute-domain-resolver';

export function findRelationshipId(layer: FeatureLayer, layerId: number): number | undefined {
  return layer.relationships?.find((rel) => rel.role === 'origin' && rel.relatedTableId === layerId)?.id;
}

export function findRefPointLayer(view: RimaView, layerId: number): FeatureLayer | undefined {
  const byTitle = view.map?.allLayers.find(
    (l) => l instanceof FeatureLayer && l.title === REF_POINT_MAP_LAYER_TITLE,
  ) as FeatureLayer | undefined;

  if (byTitle) return byTitle;

  const fromLayers = view.map?.allLayers.find(
    (l) => l instanceof FeatureLayer && (l as FeatureLayer).layerId === layerId,
  ) as FeatureLayer | undefined;

  if (fromLayers) return fromLayers;

  return view.map?.allTables?.find((l) => l instanceof FeatureLayer && (l as FeatureLayer).layerId === layerId) as
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
    .map((field) => buildEditAttributeField(field));
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

function parsePointType(attributes: Record<string, unknown>): ReferencePointType | undefined {
  const raw = attributes[REF_POINT_TYPE_FIELD];
  if (typeof raw === 'string' && (REFERENCE_POINT_TYPES as readonly string[]).includes(raw)) {
    return raw as ReferencePointType;
  }
  return undefined;
}

function graphicToReferencePoint(graphic: Graphic, relatedLayer: FeatureLayer): ReferencePoint {
  return {
    clientId: generateClientId(),
    type: parsePointType(graphic.attributes),
    objectId: graphic.attributes[relatedLayer.objectIdField],
    globalId: graphic.attributes.globalid ?? undefined,
    geometry: graphic.geometry as Point | undefined,
    attributes: { ...graphic.attributes },
    isNew: false,
    isModified: false,
  };
}
