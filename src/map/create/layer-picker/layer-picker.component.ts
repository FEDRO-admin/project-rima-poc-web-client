import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, output } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { MapViewService } from '../../view/view.service';
import { getCreatableFeatureLayers } from '../create-capability';
import '@esri/calcite-components/dist/components/calcite-icon';

@Component({
  selector: 'rima-layer-picker',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './layer-picker.component.html',
  styleUrl: './layer-picker.component.scss',
})
export class LayerPickerComponent {
  private readonly viewService = inject(MapViewService);

  readonly layerSelected = output<FeatureLayer>();

  protected readonly layers = computed<FeatureLayer[]>(() => {
    const view = this.viewService.mapView();
    if (!view?.map) return [];
    return getCreatableFeatureLayers(view.map);
  });

  protected onLayerChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const layerId = select.value;
    const layer = this.layers().find((l) => l.id === layerId);
    if (layer) {
      this.layerSelected.emit(layer);
    }
  }
}
