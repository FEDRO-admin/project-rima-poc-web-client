import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, untracked, viewChild } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-layer-list';
import { MapViewService } from '../view/view.service';
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
      item.actionsSections = [
        [
          {
            title: 'Zoom to',
            icon: 'zoom-to-object',
            id: 'zoom-to-layer',
            type: 'button',
          },
        ],
      ];
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
  }
}
