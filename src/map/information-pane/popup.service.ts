import { inject, Injectable, OnDestroy } from '@angular/core';
import { ViewService } from '../view/view.service';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SceneLayer from '@arcgis/core/layers/SceneLayer';
import Layer from '@arcgis/core/layers/Layer';
import { PopupHighlightError, PopupRefreshError } from './popup-errors';
import { PopupStore } from './popup.store';
import { ViewStore } from '../view/view.store';
import { GraphicHit } from '@arcgis/core/views/types';
import { type RimaView } from '../view/view.service';

const HITTESTABLE_LAYER_TYPES = new Set(['feature', 'scene', 'building-scene']);

interface HighlightableLayerView {
  highlight(target: Graphic): { remove(): void };
}

interface Handle {
  remove(): void;
}

@Injectable({
  providedIn: 'root',
})
export class PopupService implements OnDestroy {
  private readonly viewService = inject(ViewService);
  private readonly popupStore = inject(PopupStore);
  private readonly viewStore = inject(ViewStore);

  private clickHandle: Handle | undefined;
  private hoverHighlightHandle: Handle | undefined;
  private selectionHighlightHandle: Handle | undefined;

  ngOnDestroy(): void {
    this.clearAllHighlights();
    this.detach();
  }

  public async highlightGraphic(graphic: Graphic, type: 'hover' | 'selection'): Promise<void> {
    const view = this.viewService.activeView();
    const layer = graphic.layer;
    if (!view || !layer) return;

    try {
      const layerView = (await view.whenLayerView(layer as FeatureLayer)) as HighlightableLayerView;
      if (typeof layerView.highlight !== 'function') return;

      const handle = layerView.highlight(graphic);

      if (type === 'hover') {
        this.clearHoverHighlight();
        this.hoverHighlightHandle = handle;
      } else {
        this.clearSelectionHighlight();
        this.selectionHighlightHandle = handle;
      }
    } catch (error) {
      throw new PopupHighlightError(error);
    }
  }

  public clearHoverHighlight(): void {
    this.hoverHighlightHandle?.remove();
    this.hoverHighlightHandle = undefined;
  }

  public clearSelectionHighlight(): void {
    this.selectionHighlightHandle?.remove();
    this.selectionHighlightHandle = undefined;
  }

  public clearAllHighlights(): void {
    this.clearHoverHighlight();
    this.clearSelectionHighlight();
  }

  async refreshSelectedGraphic(): Promise<void> {
    const graphic = this.popupStore.selectedGraphic();
    if (!graphic) return;

    const layer = graphic.layer;
    if (!this.isQueryableLayer(layer)) return;

    try {
      const objectId = graphic.attributes[layer.objectIdField];
      const query = layer.createQuery();
      query.objectIds = [objectId];
      query.outFields = ['*'];
      query.returnGeometry = true;

      const featureSet = await layer.queryFeatures(query);
      const refreshedFeature = featureSet.features[0];
      if (refreshedFeature) {
        this.popupStore.replaceSelectedGraphic(refreshedFeature);
      }
    } catch (error) {
      throw new PopupRefreshError(error);
    }
  }

  public attach(view: RimaView): void {
    this.detach();

    view.popupEnabled = false;

    this.clickHandle = view.on('click', (event) => {
      this.handleClick(view, event);
    });
  }

  private detach(): void {
    this.clickHandle?.remove();
    this.clickHandle = undefined;
  }

  private async handleClick(view: RimaView, event: { x: number; y: number }): Promise<void> {
    if (!view.map) return;

    if (this.viewStore.locked()) {
      return;
    }

    const response = await view.hitTest(event, {
      include: view.map.allLayers.filter((layer) => HITTESTABLE_LAYER_TYPES.has(layer.type)).toArray() as Layer[],
    });

    const graphics = response.results
      .filter((result): result is GraphicHit => result.type === 'graphic')
      .map((result) => result.graphic);

    if (graphics.length > 0) {
      const enriched = await this.enrichGraphicAttributes(graphics);
      this.popupStore.open(enriched);
    } else {
      this.popupStore.close();
    }
  }

  // Scene/BuildingComponent layers return only cached attributes on hitTest.
  // Query the associated service to get all attributes when possible.
  private async enrichGraphicAttributes(graphics: Graphic[]): Promise<Graphic[]> {
    return Promise.all(
      graphics.map(async (graphic) => {
        if (graphic.layer instanceof FeatureLayer) return graphic;
        if (!this.isQueryableLayer(graphic.layer)) return graphic;

        try {
          const layer = graphic.layer;
          const objectId = graphic.attributes?.[layer.objectIdField];
          if (objectId == null) return graphic;

          const query = layer.createQuery();
          query.objectIds = [objectId];
          query.outFields = ['*'];
          query.returnGeometry = true;

          const result = await layer.queryFeatures(query);
          return result.features[0] ?? graphic;
        } catch {
          return graphic;
        }
      }),
    );
  }

  private isQueryableLayer(layer: unknown): layer is SceneLayer {
    return (
      layer != null &&
      typeof (layer as SceneLayer).objectIdField === 'string' &&
      typeof (layer as SceneLayer).createQuery === 'function' &&
      typeof (layer as SceneLayer).queryFeatures === 'function'
    );
  }
}
