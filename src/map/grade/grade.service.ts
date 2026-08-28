import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type Relationship from '@arcgis/core/layers/support/Relationship';
import { ViewService } from '../view/view.service';
import { HistoryStore } from '../history/history.store';
import { LayerIdResolver } from '../layer/layer-id-resolver';
import { STATUS_LAYER_NAME } from '../map-config';
import {
  findStatusRelationshipId,
  findStatusLayer,
  queryStatusRecords,
} from '../information-pane/status-tab/status-resolution';
import { ZUSTANDSKLASSE_FIELD } from './grade-config';

@Injectable({
  providedIn: 'root',
})
export class GradeService {
  private readonly viewService = inject(ViewService);
  private readonly historyStore = inject(HistoryStore);
  private readonly layerIdResolver = inject(LayerIdResolver);

  async calculateGrade(graphic: Graphic): Promise<number | undefined> {
    const view = this.viewService.activeView();
    if (!view) {
      console.warn('[GradeService] No active view');
      return undefined;
    }

    let zustandLayerId: number;
    try {
      zustandLayerId = await this.layerIdResolver.resolveIdAsync(STATUS_LAYER_NAME, view.map);
    } catch {
      console.warn('[GradeService] Cannot resolve zustand layer ID');
      return undefined;
    }

    const statusLayer = findStatusLayer(view, zustandLayerId);
    if (!statusLayer) {
      console.warn('[GradeService] Status layer not found');
      return undefined;
    }
    const values = await this.collectLeafZustandValues(graphic, zustandLayerId, statusLayer);

    if (values.length === 0) return undefined;

    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  private async collectLeafZustandValues(
    graphic: Graphic,
    zustandLayerId: number,
    statusLayer: FeatureLayer,
  ): Promise<number[]> {
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer) || !layer.relationships?.length) {
      return this.getLeafZustandValue(graphic, layer as FeatureLayer, zustandLayerId, statusLayer);
    }

    const structuralChildRelationships = layer.relationships.filter(
      (rel) => rel.role === 'origin' && rel.relatedTableId !== zustandLayerId,
    );

    if (structuralChildRelationships.length === 0) {
      return this.getLeafZustandValue(graphic, layer, zustandLayerId, statusLayer);
    }

    const values: number[] = [];
    for (const rel of structuralChildRelationships) {
      const children = await this.queryChildren(layer, graphic, rel);
      for (const child of children) {
        const childValues = await this.collectLeafZustandValues(child, zustandLayerId, statusLayer);
        values.push(...childValues);
      }
    }

    // No actual child features found — treat this feature as a leaf
    if (values.length === 0) {
      return this.getLeafZustandValue(graphic, layer, zustandLayerId, statusLayer);
    }

    return values;
  }

  private async getLeafZustandValue(
    graphic: Graphic,
    layer: FeatureLayer,
    zustandLayerId: number,
    statusLayer: FeatureLayer,
  ): Promise<number[]> {
    if (!layer?.relationships?.length) {
      return [];
    }

    const relationshipId = findStatusRelationshipId(layer, zustandLayerId);
    if (relationshipId == null) {
      return [];
    }

    const historicMoment = this.historyStore.selectedDate() ?? undefined;
    const records = await queryStatusRecords(layer, graphic, relationshipId, statusLayer, historicMoment);

    if (records.length === 0) return [];

    const zustandsklasse = records[0].attributes[ZUSTANDSKLASSE_FIELD];
    if (typeof zustandsklasse === 'number') return [zustandsklasse];

    return [];
  }

  private async queryChildren(layer: FeatureLayer, graphic: Graphic, relationship: Relationship): Promise<Graphic[]> {
    const objectId = graphic.attributes[layer.objectIdField];
    if (objectId == null) return [];

    const query = new RelationshipQuery({
      objectIds: [objectId],
      relationshipId: relationship.id,
      outFields: ['*'],
      returnGeometry: false,
      historicMoment: this.historyStore.selectedDate() ?? undefined,
    });

    const result = await layer.queryRelatedFeatures(query);
    const featureSet = result[objectId];
    if (!featureSet?.features?.length) return [];

    const relatedLayer = this.findLayerByRelationship(relationship);
    if (relatedLayer) {
      for (const feature of featureSet.features) {
        feature.layer = relatedLayer;
      }
    }

    return featureSet.features;
  }

  private findLayerByRelationship(relationship: Relationship): FeatureLayer | undefined {
    const view = this.viewService.activeView();
    if (!view?.map) return undefined;

    return view.map.allLayers.find((l) => {
      if (!(l instanceof FeatureLayer)) return false;
      return l.layerId === relationship.relatedTableId;
    }) as FeatureLayer | undefined;
  }
}
