import { inject, Injectable, OnDestroy } from '@angular/core';
import { ViewService } from '../view/view.service';
import { TablePaneStore } from './table-pane.store';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';

interface HighlightableLayerView {
  highlight(target: Graphic | number[]): { remove(): void };
}

interface Handle {
  remove(): void;
}

@Injectable({
  providedIn: 'root',
})
export class TablePaneService implements OnDestroy {
  private readonly viewService = inject(ViewService);
  private readonly store = inject(TablePaneStore);

  private hoverHighlightHandle: Handle | undefined;
  private selectionHighlightHandles: Handle[] = [];

  ngOnDestroy(): void {
    this.clearAllHighlights();
  }

  async openTable(layer: FeatureLayer): Promise<void> {
    this.clearAllHighlights();
    await layer.load();
    this.store.open(layer);
  }

  closeTable(): void {
    this.clearAllHighlights();
    this.store.close();
  }

  async highlightFeature(objectId: number, type: 'hover' | 'selection'): Promise<void> {
    const view = this.viewService.activeView();
    const layer = this.store.layer();
    if (!view || !layer) return;

    const layerView = (await view.whenLayerView(layer)) as HighlightableLayerView;
    if (typeof layerView.highlight !== 'function') return;

    const handle = layerView.highlight([objectId]);

    if (type === 'hover') {
      this.clearHoverHighlight();
      this.hoverHighlightHandle = handle;
    } else {
      this.selectionHighlightHandles.push(handle);
    }
  }

  async highlightSelection(objectIds: number[]): Promise<void> {
    this.clearSelectionHighlights();
    const view = this.viewService.activeView();
    const layer = this.store.layer();
    if (!view || !layer || objectIds.length === 0) return;

    const layerView = (await view.whenLayerView(layer)) as HighlightableLayerView;
    if (typeof layerView.highlight !== 'function') return;

    const handle = layerView.highlight(objectIds);
    this.selectionHighlightHandles.push(handle);
  }

  clearHoverHighlight(): void {
    this.hoverHighlightHandle?.remove();
    this.hoverHighlightHandle = undefined;
  }

  clearSelectionHighlights(): void {
    for (const handle of this.selectionHighlightHandles) {
      handle.remove();
    }
    this.selectionHighlightHandles = [];
  }

  clearAllHighlights(): void {
    this.clearHoverHighlight();
    this.clearSelectionHighlights();
  }

  async zoomToFeature(feature: Graphic): Promise<void> {
    const view = this.viewService.activeView();
    const layer = this.store.layer();
    if (!view || !layer) return;

    let geometry = feature.geometry;
    if (!geometry) {
      const objectId = feature.attributes[layer.objectIdField];
      const query = layer.createQuery();
      query.objectIds = [objectId];
      query.returnGeometry = true;
      query.outFields = [];
      const result = await layer.queryFeatures(query);
      geometry = result.features[0]?.geometry;
    }
    if (!geometry) return;

    view.goTo({ target: geometry, scale: Math.min(view.scale, 5000) }, { animate: true });
  }
}
