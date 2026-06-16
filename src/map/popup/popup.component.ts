import { Component, CUSTOM_ELEMENTS_SCHEMA, HostListener, inject } from '@angular/core';
import { PopupStore } from './popup.store';
import { PopupContentComponent } from './content/popup-content.component';
import { MapViewService } from '../view/view.service';
import Graphic from '@arcgis/core/Graphic';
import '@esri/calcite-components/dist/components/calcite-icon';

@Component({
  selector: 'rima-popup',
  imports: [PopupContentComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './popup.component.html',
  styleUrl: './popup.component.scss',
})
export class PopupComponent {
  protected readonly store = inject(PopupStore);
  private readonly viewService = inject(MapViewService);

  close(): void {
    this.store.close();
  }

  zoomTo(): void {
    const graphic = this.store.selectedGraphic();
    const view = this.viewService.mapView();
    if (!graphic?.geometry || !view) return;
    view.goTo({ target: graphic.geometry, zoom: 15 });
  }

  getFeatureLabel(graphic: Graphic): string {
    const attrs = graphic.attributes;
    if (!attrs) return 'Feature';
    return attrs.OBJECTID ?? attrs.FID ?? attrs.ID ?? Object.values(attrs)[0] ?? 'Feature';
  }
}
