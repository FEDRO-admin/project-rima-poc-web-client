import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, untracked, viewChild } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-layer-list';
import { MapViewService } from '../view/view.service';
import { CreateStore } from '../create/create.store';
import { isLayerCreatable } from '../create/create-capability';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import ListItem from '@arcgis/core/widgets/LayerList/ListItem';

@Component({
  selector: 'rima-toc',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './toc.component.html',
  styleUrl: './toc.component.scss',
})
export class TocComponent {
  private readonly viewService = inject(MapViewService);
  private readonly createStore = inject(CreateStore);
  private readonly layerListElement = viewChild<ElementRef<HTMLArcgisLayerListElement>>('layerList');

  constructor() {
    effect(() => {
      const view = this.viewService.mapView();
      untracked(() => {
        const layerList = this.layerListElement()?.nativeElement;
        if (view && layerList) {
          layerList.view = view;
          layerList.listItemCreatedFunction = (event): void => this.onListItemCreated(event);
        }
      });
    });
  }

  private onListItemCreated(event: { item: ListItem }): void {
    const { item } = event;
    if (item.layer?.type === 'feature' || item.layer?.type === 'wmts') {
      const zoomAction = {
        title: 'Zoom to',
        icon: 'zoom-to-object',
        id: 'zoom-to-layer',
        type: 'button',
      } as const;

      if (item.layer instanceof FeatureLayer && isLayerCreatable(item.layer)) {
        const createAction = {
          title: 'Create',
          icon: 'plus',
          id: 'create-feature',
          type: 'button',
        } as const;

        item.actionsSections = [[zoomAction, createAction]];
      } else {
        item.actionsSections = [[zoomAction]];
      }
    }
  }

  protected async onTriggerAction(event: CustomEvent): Promise<void> {
    const { action, item } = event.detail;
    if (action.id === 'zoom-to-layer') {
      const view = this.viewService.mapView();
      if (!view) return;

      const layer = item.layer;
      await layer.load();

      const extent = layer.fullExtent ?? (layer.type === 'wmts' ? layer.activeLayer?.fullExtent : undefined);
      if (extent) {
        view.goTo(extent);
      }
    }

    if (action.id === 'create-feature') {
      const layer = item.layer;
      if (layer instanceof FeatureLayer) {
        await layer.load();
        this.createStore.activate(layer);
      }
    }
  }
}
