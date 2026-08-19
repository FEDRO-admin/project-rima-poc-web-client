import { effect, inject, Injectable, untracked } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { FeatureEditResult } from '@arcgis/core/editing/types';

import { ViewService } from '../view/view.service';
import { LayerIdResolver } from '../layer/layer-id-resolver';
import { REF_POINT_LAYER_NAME } from '../map-config';
import { RBBS_VON_FIELD } from './rbbs-config';
import { RbbsService } from './rbbs.service';

@Injectable({
  providedIn: 'root',
})
export class RbbsEffects {
  private readonly viewService = inject(ViewService);
  private readonly layerIdResolver = inject(LayerIdResolver);
  private readonly rbbsService = inject(RbbsService);

  private handles: { remove(): void }[] = [];
  private calculating = new Set<number>();

  constructor() {
    this.attachLayerListeners();
  }

  private attachLayerListeners(): void {
    effect((onCleanup) => {
      const view = this.viewService.activeView();

      untracked(() => {
        this.removeAllHandles();

        if (!view?.map) return;

        this.initListeners();
      });

      onCleanup(() => this.removeAllHandles());
    });
  }

  private async initListeners(): Promise<void> {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    let refPointLayerId: number | undefined;
    try {
      refPointLayerId = this.layerIdResolver.resolveId(REF_POINT_LAYER_NAME);
    } catch {
      return;
    }

    const layers: FeatureLayer[] = [];
    view.map.allLayers.forEach((layer) => {
      if (layer instanceof FeatureLayer) layers.push(layer);
    });

    await Promise.all(layers.map((layer) => layer.when()));

    for (const layer of layers) {
      if (this.isRbbsLayer(layer)) {
        const handle = layer.on('edits', (event) => {
          this.onIObjectEdited(layer, event.updatedFeatures);
        });
        this.handles.push(handle);
      }

      if (layer.layerId === refPointLayerId) {
        const handle = layer.on('edits', (event) => {
          this.onReferenzpunktChanged(layer, event);
        });
        this.handles.push(handle);
      }
    }
  }

  private isRbbsLayer(layer: FeatureLayer): boolean {
    return layer.fields?.some((f) => f.name === RBBS_VON_FIELD) ?? false;
  }

  private async onIObjectEdited(layer: FeatureLayer, updatedFeatures: FeatureEditResult[]): Promise<void> {
    if (updatedFeatures.length === 0) return;

    for (const result of updatedFeatures) {
      if (result.error || result.objectId == null) continue;
      if (this.calculating.has(result.objectId)) continue;
      await this.recalculateForObjectId(layer, result.objectId);
    }
  }

  private async onReferenzpunktChanged(
    refLayer: FeatureLayer,
    event: {
      addedFeatures: FeatureEditResult[];
      updatedFeatures: FeatureEditResult[];
      deletedFeatures: FeatureEditResult[];
    },
  ): Promise<void> {
    const affectedObjectIds = [...event.addedFeatures, ...event.updatedFeatures, ...event.deletedFeatures]
      .filter((r) => !r.error && r.objectId != null)
      .map((r) => r.objectId as number);

    if (affectedObjectIds.length === 0) return;

    const parentIds = await this.resolveParentIds(refLayer, affectedObjectIds);
    if (parentIds.length === 0) return;

    await this.recalculateForParentIds(parentIds);
  }

  private async resolveParentIds(refLayer: FeatureLayer, objectIds: number[]): Promise<string[]> {
    const query = refLayer.createQuery();
    query.objectIds = objectIds;
    query.outFields = ['fk_parent'];
    query.returnGeometry = false;

    const result = await refLayer.queryFeatures(query);
    const parentIds = new Set<string>();

    for (const feature of result.features) {
      const fkParent = feature.attributes.fk_parent as string | null;
      if (fkParent) parentIds.add(fkParent);
    }

    return [...parentIds];
  }

  private async recalculateForParentIds(parentIds: string[]): Promise<void> {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    const rbbsLayers: FeatureLayer[] = [];
    view.map.allLayers.forEach((layer) => {
      if (layer instanceof FeatureLayer && this.isRbbsLayer(layer)) {
        rbbsLayers.push(layer);
      }
    });

    for (const parentId of parentIds) {
      for (const layer of rbbsLayers) {
        const query = layer.createQuery();
        query.where = `id = '${parentId}'`;
        query.outFields = ['*'];
        query.returnGeometry = true;

        const result = await layer.queryFeatures(query);
        const graphic = result.features[0];
        if (graphic) {
          const objectId = graphic.attributes[layer.objectIdField] as number;
          this.calculating.add(objectId);
          try {
            await this.rbbsService.calculateAndSave(layer, graphic);
          } finally {
            this.calculating.delete(objectId);
          }
          break;
        }
      }
    }
  }

  private async recalculateForObjectId(layer: FeatureLayer, objectId: number): Promise<void> {
    const query = layer.createQuery();
    query.objectIds = [objectId];
    query.outFields = ['*'];
    query.returnGeometry = true;

    const result = await layer.queryFeatures(query);
    const graphic = result.features[0];
    if (!graphic) return;

    this.calculating.add(objectId);
    try {
      await this.rbbsService.calculateAndSave(layer, graphic);
    } finally {
      this.calculating.delete(objectId);
    }
  }

  private removeAllHandles(): void {
    for (const handle of this.handles) {
      handle.remove();
    }
    this.handles = [];
  }
}
