import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type Relationship from '@arcgis/core/layers/support/Relationship';
import type Point from '@arcgis/core/geometry/Point';
import { MapViewService } from '../../view/view.service';
import { AttributeEditField, convertAttributeFieldType } from '../attribute-edit-field';
import { ReferencePoint, ReferencePointRelationshipInfo, classifyRelationshipName } from './reference-point-types';
import { isImmutableField } from '../../layer/layer-attributes';

@Injectable({
  providedIn: 'root',
})
export class ReferencePointResolutionService {
  private readonly viewService = inject(MapViewService);

  resolveRelationships(layer: FeatureLayer): ReferencePointRelationshipInfo[] {
    if (!layer.relationships?.length) return [];

    const results: ReferencePointRelationshipInfo[] = [];

    for (const rel of layer.relationships) {
      if (rel.role !== 'origin') continue;

      const relatedLayer = this.findLayerByRelationship(rel);
      if (!relatedLayer) continue;

      // Classify by the related layer's title (e.g. "Von Punkte", "Bis Punkte")
      const type = classifyRelationshipName(relatedLayer.title ?? '');
      if (!type) continue;

      const fields = this.resolveEditableFields(relatedLayer);
      results.push({
        type,
        relationshipId: rel.id,
        relatedLayer,
        fields,
      });
    }

    return results;
  }

  async queryExistingPoints(layer: FeatureLayer, graphic: Graphic, relationshipId: number): Promise<ReferencePoint[]> {
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

    return featureSet.features.map((feature: Graphic) => this.graphicToReferencePoint(feature));
  }

  private graphicToReferencePoint(graphic: Graphic): ReferencePoint {
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

  private resolveEditableFields(layer: FeatureLayer): AttributeEditField[] {
    if (!layer.fields?.length) return [];

    return layer.fields
      .filter((field) => !isImmutableField(field.name, layer))
      .filter((field) => field.name.toLowerCase() !== 'parent_id')
      .map((field) => ({
        name: field.name,
        alias: field.alias || field.name,
        fieldType: convertAttributeFieldType(field),
        nullable: field.nullable,
        length: field.length ?? undefined,
        codedValues: this.extractCodedValues(field),
        editable: field.editable,
      }));
  }

  private extractCodedValues(field: {
    domain?: { type?: string; codedValues?: { code: string | number; name: string }[] } | null;
  }): { code: string | number; name: string }[] {
    if (field.domain?.type === 'coded-value' && field.domain.codedValues) {
      return field.domain.codedValues.map((cv) => ({ code: cv.code, name: cv.name }));
    }
    return [];
  }

  private findLayerByRelationship(relationship: Relationship): FeatureLayer | undefined {
    const view = this.viewService.mapView();
    if (!view?.map) return undefined;

    const allLayers = view.map.allLayers;
    return allLayers.find((l) => {
      if (!(l instanceof FeatureLayer)) return false;
      return l.layerId === relationship.relatedTableId;
    }) as FeatureLayer | undefined;
  }
}
