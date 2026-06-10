import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, viewChild, ElementRef, effect, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import { MapViewService } from './view/view.service';
import { CatalogService } from './catalog/catalog.service';
import { RIMA_SWITZERLAND_EXTENT } from './map-constants';
import { LayerService } from './layer/layer.service';
import { TocComponent } from './toc/toc.component';
import { ViewInitialisationError } from './view/view-errors';

@Component({
  selector: 'rima-map',
  imports: [TocComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [PopupComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly viewService = inject(MapViewService);
  private readonly catalogService = inject(CatalogService);
  private readonly layerService = inject(LayerService);

  protected readonly switzerlandExtent = RIMA_SWITZERLAND_EXTENT;

  private readonly mapElement = viewChild<ElementRef<HTMLArcgisMapElement>>('arcgisMap');
  private mapInitialised = false;

  constructor() {
    effect(() => {
      const mapElement = this.mapElement();
      untracked(() => {
        if (mapElement?.nativeElement && !this.mapInitialised) {
          this.mapInitialised = true;
          this.initMap(mapElement.nativeElement);
        }
      });
    });
  }

  private async initMap(element: HTMLArcgisMapElement): Promise<void> {
    const view = element.view;
    if (!view) {
      throw new ViewInitialisationError('MapView is not available on the arcgis-map element');
    }
    await this.viewService.registerMapView(view);
    this.viewService.addBasemap();
    await view.when();
    const catalog = await this.catalogService.buildMapCatalog();
    this.layerService.addCatalogToMap(catalog);
  }
}
