import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject, input, OnDestroy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-tree';
import '@esri/calcite-components/dist/components/calcite-tree-item';
import '@esri/calcite-components/dist/components/calcite-loader';
import { HierarchyStore } from './hierarchy.store';
import { HierarchyNode } from './hierarchy-node';
import { MapViewService } from '../../../view/view.service';

interface HighlightHandle {
  remove(): void;
}

@Component({
  selector: 'rima-hierarchy-tab',
  imports: [NgTemplateOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './hierarchy-tab.component.html',
  styleUrl: './hierarchy-tab.component.scss',
})
export class HierarchyTabComponent implements OnDestroy {
  readonly graphic = input.required<Graphic>();

  protected readonly hierarchyStore = inject(HierarchyStore);
  private readonly viewService = inject(MapViewService);
  private highlightHandle: HighlightHandle | undefined;

  constructor() {
    effect(() => {
      const graphic = this.graphic();
      if (graphic) {
        this.hierarchyStore.setGraphic(graphic);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearHighlight();
  }

  protected async onNodeClick(event: Event, node: HierarchyNode): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    this.clearHighlight();
    const graphic = node.graphic;
    const layer = graphic.layer;
    const view = this.viewService.mapView();

    if (!view || !graphic.geometry) return;

    if (layer instanceof FeatureLayer) {
      const objectId = graphic.attributes[layer.objectIdField];
      const layerView = await view.whenLayerView(layer);
      this.highlightHandle = layerView.highlight(objectId);
    }

    view.goTo({ target: graphic.geometry });
  }

  private clearHighlight(): void {
    this.highlightHandle?.remove();
    this.highlightHandle = undefined;
  }
}
