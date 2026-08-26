import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import esriRequest from '@arcgis/core/request';
import Point from '@arcgis/core/geometry/Point';
import type Polygon from '@arcgis/core/geometry/Polygon';
import type Polyline from '@arcgis/core/geometry/Polyline';
import type MapView from '@arcgis/core/views/MapView';
import type SceneView from '@arcgis/core/views/SceneView';

import { ViewService } from '../view/view.service';
import { LayerIdResolver } from '../layer/layer-id-resolver';
import { REF_POINT_LAYER_NAME, REF_POINT_TYPE_FIELD } from '../map-config';
import {
  findRelationshipId,
  findRefPointLayer,
  queryRelatedPoints,
} from '../information-pane/reference-tab/reference-point-resolution';
import type { ReferencePoint } from '../information-pane/reference-tab/reference-point-types';
import {
  RBBS_TRANSFORM_URL,
  RBBS_VON_FIELD,
  RBBS_BIS_FIELD,
  RBBS_KM_VON_FIELD,
  RBBS_KM_BIS_FIELD,
  RBBS_UH_ABSCHNITT_FIELD,
} from './rbbs-config';
import { RbbsCalculationError, RbbsSaveError } from './rbbs-errors';
import type { XyToRbbsResult } from './rbbs-types';

type AttributeValue = string | number | null;

@Injectable({
  providedIn: 'root',
})
export class RbbsService {
  private readonly viewService = inject(ViewService);
  private readonly layerIdResolver = inject(LayerIdResolver);

  async calculateAndSave(layer: FeatureLayer, graphic: Graphic): Promise<void> {
    try {
      const coordinates = await this.resolveCoordinates(layer, graphic);
      if (!coordinates) return;

      const results = await this.callSoe(coordinates.vonPoint, coordinates.bisPoint);
      if (!results || results.length < 2) return;

      const attributes = this.mapToAttributes(results[0], results[1]);
      await this.saveAttributes(layer, graphic, attributes);
    } catch (error) {
      if (error instanceof RbbsCalculationError || error instanceof RbbsSaveError) throw error;
      throw new RbbsCalculationError(error);
    }
  }

  private async resolveCoordinates(
    layer: FeatureLayer,
    graphic: Graphic,
  ): Promise<{ vonPoint: Point; bisPoint: Point } | undefined> {
    let vonRef: ReferencePoint | undefined;
    let bisRef: ReferencePoint | undefined;
    try {
      ({ vonRef, bisRef } = await this.queryReferenzpunkte(layer, graphic));
    } catch {
      // Fall through to geometry-based resolution
    }

    const vertices = this.extractVertices(graphic);

    const vonPoint = vonRef?.geometry ?? (vertices?.length ? this.findWestMost(vertices) : undefined);
    const bisPoint = bisRef?.geometry ?? (vertices?.length ? this.findEastMost(vertices) : undefined);

    if (!vonPoint || !bisPoint) return undefined;
    return { vonPoint, bisPoint };
  }

  async hasCompleteReferenzpunkte(layer: FeatureLayer, graphic: Graphic): Promise<boolean> {
    const { vonRef, bisRef } = await this.queryReferenzpunkte(layer, graphic);
    return !!(vonRef?.geometry && bisRef?.geometry);
  }

  async recalculateForParent(parentId: string): Promise<void> {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    const rbbsLayers = this.findRbbsLayers(view);
    for (const layer of rbbsLayers) {
      const query = layer.createQuery();
      query.where = `id = '${parentId}'`;
      query.outFields = ['*'];
      query.returnGeometry = true;

      const result = await layer.queryFeatures(query);
      const graphic = result.features[0];
      if (graphic) {
        await this.calculateAndSave(layer, graphic);
        break;
      }
    }
  }

  findRbbsLayers(view: MapView | SceneView): FeatureLayer[] {
    const layers: FeatureLayer[] = [];
    view.map?.allLayers.forEach((layer) => {
      if (layer instanceof FeatureLayer && layer.fields?.some((f) => f.name === RBBS_VON_FIELD)) {
        layers.push(layer);
      }
    });
    return layers;
  }

  private async queryReferenzpunkte(
    layer: FeatureLayer,
    graphic: Graphic,
  ): Promise<{ vonRef: ReferencePoint | undefined; bisRef: ReferencePoint | undefined }> {
    const view = this.viewService.activeView();
    if (!view) return { vonRef: undefined, bisRef: undefined };

    let refPointLayerId: number;
    try {
      refPointLayerId = await this.layerIdResolver.resolveIdAsync(REF_POINT_LAYER_NAME, view.map);
    } catch {
      return { vonRef: undefined, bisRef: undefined };
    }
    const relatedLayer = findRefPointLayer(view, refPointLayerId);
    const relationshipId = relatedLayer ? findRelationshipId(layer, relatedLayer.layerId) : undefined;

    if (relationshipId == null || !relatedLayer) return { vonRef: undefined, bisRef: undefined };

    try {
      const points = await queryRelatedPoints(layer, graphic, relationshipId, relatedLayer);
      const vonRef = points.find((p) => p.attributes[REF_POINT_TYPE_FIELD] === 'von');
      const bisRef = points.find((p) => p.attributes[REF_POINT_TYPE_FIELD] === 'bis');
      return { vonRef, bisRef };
    } catch {
      return { vonRef: undefined, bisRef: undefined };
    }
  }

  private async callSoe(vonPoint: Point, bisPoint: Point): Promise<XyToRbbsResult[] | undefined> {
    const requestList = [vonPoint, bisPoint].map((point) => this.buildSoeRequestItem(point));

    const response = await esriRequest(RBBS_TRANSFORM_URL, {
      query: {
        f: 'json',
        // eslint-disable-next-line @typescript-eslint/naming-convention -- SOE REST contract requires PascalCase.
        XyToRbbsRequestList: JSON.stringify(requestList),
      },
      method: 'post',
      responseType: 'json',
    });

    const data = response.data as Record<string, unknown>;
    if (data['status'] === 'error') return undefined;

    const rawResults = data['XyToRbbsResultList'] as Record<string, unknown>[];
    if (!Array.isArray(rawResults)) return undefined;

    return rawResults.map((raw) => this.parseResult(raw));
  }

  private parseResult(raw: Record<string, unknown>): XyToRbbsResult {
    const rawPointRbbs = raw['PointRbbs'] as Record<string, unknown>;
    const rawRefPtInfo = raw['RefPtInfo'] as Record<string, unknown>;
    const rawAxisSegInfo = rawRefPtInfo['AxisSegmentInfo'] as Record<string, unknown>;
    const rawAxisInfo = rawAxisSegInfo['AxisInfo'] as Record<string, unknown>;

    return {
      pointRbbs: {
        refPtID: rawPointRbbs['RefPtID'] as string,
        u: rawPointRbbs['U'] as number,
        v: rawPointRbbs['V'] as number,
      },
      refPtInfo: {
        refPtID: rawRefPtInfo['RefPtID'] as string,
        name: (rawRefPtInfo['Name'] as string) ?? null,
        axisSegmentInfo: {
          axisSegmentID: rawAxisSegInfo['AxisSegmentID'] as string,
          name: rawAxisSegInfo['Name'] as string,
          axisInfo: {
            axisID: rawAxisInfo['AxisID'] as string,
            name: rawAxisInfo['Name'] as string,
            typ: rawAxisInfo['Typ'] as string,
            positionCode: rawAxisInfo['PositionCode'] as string,
          },
        },
      },
    };
  }

  private mapToAttributes(vonResult: XyToRbbsResult, bisResult: XyToRbbsResult): Record<string, AttributeValue> {
    return {
      [RBBS_VON_FIELD]: this.formatRbbsNotation(vonResult),
      [RBBS_BIS_FIELD]: this.formatRbbsNotation(bisResult),
      [RBBS_KM_VON_FIELD]: String(vonResult.pointRbbs.u),
      [RBBS_KM_BIS_FIELD]: String(bisResult.pointRbbs.u),
      [RBBS_UH_ABSCHNITT_FIELD]:
        vonResult.refPtInfo.axisSegmentInfo.name ?? bisResult.refPtInfo.axisSegmentInfo.name ?? null,
    };
  }

  private async saveAttributes(
    layer: FeatureLayer,
    graphic: Graphic,
    values: Record<string, AttributeValue>,
  ): Promise<void> {
    const objectIdField = layer.objectIdField;
    const objectId = graphic.attributes[objectIdField];

    const updateGraphic = new Graphic({
      attributes: { [objectIdField]: objectId, ...values },
    });

    const result = await layer.applyEdits({ updateFeatures: [updateGraphic] });
    const updateResult = result.updateFeatureResults[0];

    if (updateResult?.error) {
      throw new RbbsSaveError(updateResult.error);
    }

    layer.refresh();
  }

  private formatRbbsNotation(result: XyToRbbsResult): string {
    const axisName = result.refPtInfo.axisSegmentInfo.axisInfo.name;
    const u = result.pointRbbs.u;
    const v = result.pointRbbs.v;
    const uSign = u >= 0 ? '+' : '';
    const vSign = v >= 0 ? '+' : '';
    return `${axisName} BP${uSign}${u} V${vSign}${v}`;
  }

  private extractVertices(graphic: Graphic): Point[] | undefined {
    const geometry = graphic.geometry;
    if (!geometry) return undefined;

    if (geometry.type === 'point') {
      return [geometry as Point];
    }

    const coords = this.getCoordinateRing(graphic);
    if (!coords || coords.length === 0) return undefined;

    return coords.map(
      (coord) =>
        new Point({
          x: coord[0],
          y: coord[1],
          spatialReference: geometry.spatialReference,
        }),
    );
  }

  private getCoordinateRing(graphic: Graphic): number[][] | undefined {
    const geometry = graphic.geometry;
    if (geometry?.type === 'polygon') {
      return (geometry as Polygon).rings[0];
    }
    if (geometry?.type === 'polyline') {
      return (geometry as Polyline).paths[0];
    }
    return undefined;
  }

  // SOE expects PascalCase JSON keys per its REST contract
  private buildSoeRequestItem(point: Point): Record<string, unknown> {
    /* eslint-disable @typescript-eslint/naming-convention -- SOE REST contract requires PascalCase keys. */
    return {
      Date: new Date().toISOString(),
      PointXY: { X: point.x, Y: point.y },
    };
    /* eslint-enable @typescript-eslint/naming-convention -- Re-enable after SOE request payload. */
  }

  private findWestMost(points: Point[]): Point {
    return points.reduce((west, p) => (p.x < west.x ? p : west), points[0]);
  }

  private findEastMost(points: Point[]): Point {
    return points.reduce((east, p) => (p.x > east.x ? p : east), points[0]);
  }
}
