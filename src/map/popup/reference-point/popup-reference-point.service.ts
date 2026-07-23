import { inject, Injectable } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import { PopupReferencePointStore } from './popup-reference-point.store';
import { ReferencePointResolutionService } from '../../reference/reference-point-resolution.service';
import { ReferencePointLoadError } from '../../reference/reference-point-errors';
import {
  REF_POINT_FK_PARENT_FIELD,
  REF_POINT_VON_SYMBOL,
  REF_POINT_BIS_SYMBOL,
} from '../../reference/reference-point-config';
import type { ReferencePointType } from '../../reference/reference-point-types';
import { MapViewService } from '../../view/view.service';

interface SavedLayerState {
  layer: FeatureLayer;
  type: ReferencePointType;
  definitionExpression: string;
  visible: boolean;
  renderer: FeatureLayer['renderer'];
  parentGroup: GroupLayer | undefined;
  layerIndexInGroup: number;
}

@Injectable({
  providedIn: 'root',
})
export class PopupReferencePointService {
  private readonly store = inject(PopupReferencePointStore);
  private readonly resolutionService = inject(ReferencePointResolutionService);
  private readonly viewService = inject(MapViewService);

  private savedLayerStates: SavedLayerState[] = [];
  private currentParentId: string | undefined;

  resolveForGraphic(graphic: Graphic): void {
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) {
      this.store.reset();
      return;
    }

    const relationships = this.resolutionService.resolveRelationships(layer);
    if (relationships.length === 0) {
      this.store.reset();
      return;
    }

    const vonRel = relationships.find((r) => r.type === 'von');
    const bisRel = relationships.find((r) => r.type === 'bis');
    this.store.setRelationships(vonRel, bisRel);
    this.currentParentId = graphic.attributes.id;
  }

  async loadPoints(graphic: Graphic): Promise<void> {
    const layer = graphic.layer;
    if (!(layer instanceof FeatureLayer)) return;

    const vonRel = this.store.von().relationship;
    const bisRel = this.store.bis().relationship;
    if (!vonRel && !bisRel) return;

    this.store.setLoading(true);

    try {
      let vonPoints = this.store.von().points;
      let bisPoints = this.store.bis().points;

      if (vonRel) {
        vonPoints = await this.resolutionService.queryExistingPoints(layer, graphic, vonRel.relationshipId);
      }
      if (bisRel) {
        bisPoints = await this.resolutionService.queryExistingPoints(layer, graphic, bisRel.relationshipId);
      }
      this.store.setPoints(vonPoints, bisPoints);
    } catch (error) {
      this.store.setLoading(false);
      throw new ReferencePointLoadError(error);
    }
  }

  showOnMap(): void {
    const vonRel = this.store.von().relationship;
    const bisRel = this.store.bis().relationship;
    const parentId = this.currentParentId;
    if (!parentId || (!vonRel && !bisRel)) return;

    this.restoreLayers();

    const expression = `${REF_POINT_FK_PARENT_FIELD} = '${parentId}'`;

    if (vonRel) {
      this.activateLayer(vonRel.relatedLayer, expression, 'von');
    }
    if (bisRel) {
      this.activateLayer(bisRel.relatedLayer, expression, 'bis');
    }

    this.store.setVisible(true);
  }

  hide(): void {
    this.restoreLayers();
    this.store.setVisible(false);
  }

  cleanup(): void {
    this.restoreLayers();
    this.currentParentId = undefined;
    this.store.reset();
  }

  private activateLayer(layer: FeatureLayer, expression: string, type: ReferencePointType): void {
    const view = this.viewService.mapView();
    if (!view?.map) return;

    const parentGroup = this.findParentGroupLayer(layer);
    const layerIndexInGroup = parentGroup ? parentGroup.layers.indexOf(layer) : -1;

    this.savedLayerStates.push({
      layer,
      type,
      definitionExpression: layer.definitionExpression ?? '',
      visible: layer.visible,
      renderer: layer.renderer,
      parentGroup,
      layerIndexInGroup,
    });

    // Remove from GroupLayer and add to map root (renders on top)
    if (parentGroup) {
      parentGroup.layers.remove(layer);
    }

    layer.definitionExpression = expression;
    layer.renderer = new SimpleRenderer({
      symbol: type === 'von' ? REF_POINT_VON_SYMBOL : REF_POINT_BIS_SYMBOL,
    });
    layer.visible = true;

    view.map.add(layer);
  }

  private restoreLayers(): void {
    const view = this.viewService.mapView();

    for (const state of this.savedLayerStates) {
      // Remove from map root
      if (view?.map) {
        view.map.remove(state.layer);
      }

      // Restore original state
      state.layer.definitionExpression = state.definitionExpression;
      state.layer.renderer = state.renderer;
      state.layer.visible = state.visible;

      // Put back in GroupLayer at original position
      if (state.parentGroup) {
        const insertIndex = Math.min(state.layerIndexInGroup, state.parentGroup.layers.length);
        state.parentGroup.layers.add(state.layer, insertIndex);
      }
    }
    this.savedLayerStates = [];
  }

  private findParentGroupLayer(layer: FeatureLayer): GroupLayer | undefined {
    const parent = layer.parent;
    if (parent instanceof GroupLayer) {
      return parent;
    }
    return undefined;
  }
}
