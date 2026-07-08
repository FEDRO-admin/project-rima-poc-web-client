import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, untracked, viewChild } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-layer-list';
import { MapViewService } from '../view/view.service';
import { CreateStore } from '../create/create.store';
import { HistoryPickerComponent } from '../history/history-picker/history-picker.component';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SubtypeGroupLayer from '@arcgis/core/layers/SubtypeGroupLayer';
import SubtypeSublayer from '@arcgis/core/layers/support/SubtypeSublayer';
import Layer from '@arcgis/core/layers/Layer';
import ListItem from '@arcgis/core/widgets/LayerList/ListItem';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';

@Component({
  selector: 'rima-toc',
  imports: [HistoryPickerComponent],
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
    const sections = [];

    if (
      item.layer instanceof FeatureLayer ||
      item.layer instanceof MapImageLayer ||
      item.layer instanceof SubtypeGroupLayer
    ) {
      const zoomAction = {
        title: 'Zoom to',
        icon: 'zoom-to-object',
        id: 'zoom-to-layer',
        type: 'button',
      } as const;
      sections.push([zoomAction]);
    }

    if (item.layer && (item.layer instanceof FeatureLayer || 'subtypeCode' in item.layer)) {
      const createAction = {
        title: 'Create',
        icon: 'plus',
        id: 'create-feature',
        type: 'button',
      } as const;
      sections.push([createAction]);
    }

    item.actionsSections = sections;
  }

  protected async onTriggerAction(event: CustomEvent): Promise<void> {
    const { action, item } = event.detail;
    if (action.id === 'zoom-to-layer') await this.zoomToLayer(item.layer);
    if (action.id === 'create-feature') await this.createFeature(item.layer);
  }

  private async zoomToLayer(layer: Layer): Promise<void> {
    const view = this.viewService.mapView();
    if (!view) return;

    await layer.load();

    const extent =
      layer.fullExtent ?? (layer.type === 'wmts' ? (layer as WMTSLayer).activeLayer?.fullExtent : undefined);
    if (extent) {
      view.goTo(extent);
    }
  }

  private async createFeature(layer: Layer): Promise<void> {
    if ('subtypeCode' in layer) {
      const sublayer = layer as unknown as SubtypeSublayer;
      const parentLayer = (sublayer as unknown as { parent: SubtypeGroupLayer }).parent;
      await parentLayer.load();
      const subtypeField = parentLayer.subtypeField;
      const subtypeValue = sublayer.subtypeCode;
      this.createStore.activate(parentLayer, subtypeField, subtypeValue);
      return;
    }

    if (!(layer instanceof FeatureLayer)) return;

    await layer.load();
    const subtypeField = layer.subtypeField || undefined;

    let subtypeValue: number | string | undefined;
    if (subtypeField) {
      const query = layer.createQuery();
      query.num = 1;
      query.outFields = [subtypeField];
      const result = await layer.queryFeatures(query);
      subtypeValue = result.features[0]?.attributes?.[subtypeField] as number | string | undefined;

      if (subtypeValue == null) {
        subtypeValue = layer.sourceJSON?.['defaultSubtypeCode'] as number | string | undefined;
      }
    }
    this.createStore.activate(layer, subtypeField, subtypeValue);
  }
}
