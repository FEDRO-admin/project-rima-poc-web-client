import { inject, Injectable, OnDestroy } from '@angular/core';
import { MapViewService } from '../view/view.service';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { PopupHighlightError } from './popup-errors';

interface Handle {
  remove(): void;
}

@Injectable({
  providedIn: 'root',
})
export class PopupHighlightService implements OnDestroy {
  private readonly viewService = inject(MapViewService);

  private hoverHighlight: Handle | undefined;
  private selectionHighlight: Handle | undefined;

  ngOnDestroy(): void {
    this.clearAllHighlights();
  }

  public async highlightGraphic(graphic: Graphic, type: 'hover' | 'selection'): Promise<void> {
    const view = this.viewService.mapView();
    if (!view || !(graphic.layer instanceof FeatureLayer)) return;

    try {
      const layerView = await view.whenLayerView(graphic.layer);
      const handle = layerView.highlight(graphic);

      if (type === 'hover') {
        this.clearHoverHighlight();
        this.hoverHighlight = handle;
      } else {
        this.clearSelectionHighlight();
        this.selectionHighlight = handle;
      }
    } catch (error) {
      throw new PopupHighlightError(error);
    }
  }

  public clearHoverHighlight(): void {
    this.hoverHighlight?.remove();
    this.hoverHighlight = undefined;
  }

  public clearSelectionHighlight(): void {
    this.selectionHighlight?.remove();
    this.selectionHighlight = undefined;
  }

  public clearAllHighlights(): void {
    this.clearHoverHighlight();
    this.clearSelectionHighlight();
  }
}
