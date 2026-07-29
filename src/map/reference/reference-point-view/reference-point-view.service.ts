import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import { resolveAllRelationships, queryRelatedPoints } from '../reference-point-resolution';
import { ReferencePointLoadError } from '../reference-point-errors';
import { REF_POINT_TYPE_CONFIGS } from '../reference-point-config';
import type { ReferencePoint, ReferencePointRelationshipInfo, ReferencePointType } from '../reference-point-types';
import { MapViewService } from '../../view/mapview/mapview.service';

@Injectable({
  providedIn: 'root',
})
export class ReferencePointViewService {
  private readonly viewService = inject(MapViewService);

  private highlightLayer: GraphicsLayer | undefined;

  resolveRelationship(layer: FeatureLayer, type: ReferencePointType): ReferencePointRelationshipInfo | undefined {
    const view = this.viewService.getMapView();
    const relationships = resolveAllRelationships(layer, view);
    return relationships.find((r) => r.type === type);
  }

  async loadPoints(
    layer: FeatureLayer,
    graphic: Graphic,
    relationshipId: number,
    relatedLayer: FeatureLayer,
  ): Promise<ReferencePoint[]> {
    try {
      return await queryRelatedPoints(layer, graphic, relationshipId, relatedLayer);
    } catch (error) {
      throw new ReferencePointLoadError(error);
    }
  }

  highlightPoint(point: ReferencePoint, type: ReferencePointType): Graphic {
    this.ensureHighlightLayer();

    const graphic = new Graphic({
      geometry: point.geometry ?? undefined,
      symbol: REF_POINT_TYPE_CONFIGS[type].symbol,
    });

    this.highlightLayer!.add(graphic);
    return graphic;
  }

  unhighlightPoint(graphic: Graphic): void {
    this.highlightLayer?.remove(graphic);
  }

  cleanup(): void {
    const view = this.viewService.getMapView();
    if (this.highlightLayer) {
      this.highlightLayer.removeAll();
      view?.map?.remove(this.highlightLayer);
      this.highlightLayer = undefined;
    }
  }

  private ensureHighlightLayer(): void {
    if (this.highlightLayer) return;

    const view = this.viewService.getMapView();
    if (!view?.map) return;

    this.highlightLayer = new GraphicsLayer({ title: 'Reference Point Highlights', listMode: 'hide' });
    view.map.add(this.highlightLayer);
  }
}
