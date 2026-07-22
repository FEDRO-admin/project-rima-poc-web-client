import { inject, Injectable, OnDestroy } from '@angular/core';
import { ViewService } from '../view/view.service';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { PopupHighlightError, PopupRefreshError } from './popup-errors';
import { PopupStore } from './popup.store';
import { EditStore } from '../edit/edit.store';
import { CreateStore } from '../create/create.store';
import { DeleteStore } from '../delete/delete.store';
import { GraphicHit } from '@arcgis/core/views/types';
import { type RimaView } from '../view/view.service';

interface Handle {
  remove(): void;
}

@Injectable({
  providedIn: 'root',
})
export class PopupService implements OnDestroy {
  private readonly viewService = inject(ViewService);
  private readonly popupStore = inject(PopupStore);
  private readonly editStore = inject(EditStore);
  private readonly createStore = inject(CreateStore);
  private readonly deleteStore = inject(DeleteStore);

  private clickHandle: Handle | undefined;
  private hoverHighlightHandle: Handle | undefined;
  private selectionHighlightHandle: Handle | undefined;

  ngOnDestroy(): void {
    this.clearAllHighlights();
    this.detach();
  }

  public async highlightGraphic(graphic: Graphic, type: 'hover' | 'selection'): Promise<void> {
    const view = this.viewService.activeView();
    if (!view || !(graphic.layer instanceof FeatureLayer)) return;

    try {
      const layerView = await view.whenLayerView(graphic.layer);
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
    if (!(layer instanceof FeatureLayer)) return;

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

    // Ignore all map clicks while in edit or create mode
    if (this.editStore.active() || this.createStore.active() || this.deleteStore.active()) {
      return;
    }

    const response = await view.hitTest(event, {
      include: view.map.allLayers.filter((layer) => layer.type === 'feature').toArray() as FeatureLayer[],
    });

    const graphics = response.results
      .filter((result): result is GraphicHit => result.type === 'graphic')
      .map((result) => result.graphic);

    if (graphics.length > 0) {
      this.popupStore.open(graphics);
    } else {
      this.popupStore.close();
    }
  }
}
