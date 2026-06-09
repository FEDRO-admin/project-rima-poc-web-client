import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, viewChild, ElementRef, effect, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import { MapViewService } from './view/view.service';
import { CatalogService } from './catalog/catalog.service';
import MapView from '@arcgis/core/views/MapView';
import { MapViewInitialiseError } from './map-errors';
import { RIMA_SWITZERLAND_EXTENT } from './map-constants';
import { LayerService } from './layer/layer.service';

@Component({
  selector: 'rima-map',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly viewService = inject(MapViewService);
  private readonly catalogService = inject(CatalogService);
  private readonly layerService = inject(LayerService);

  protected readonly switzerlandExtent = RIMA_SWITZERLAND_EXTENT;

  private readonly mapElement = viewChild<ElementRef<HTMLArcgisMapElement>>('arcgisMap');

  constructor() {
    effect(() => {
      const mapElement = this.mapElement();
      untracked(() => {
        if (mapElement?.nativeElement) {
          const view = mapElement.nativeElement.view;
          this.onViewReady(view).catch((error) => {
            throw new MapViewInitialiseError(error instanceof Error ? error.message : String(error));
          });
        }
      });
    });
  }

  protected async onViewReady(view: MapView): Promise<void> {
    await this.viewService.registerMapView(view);
    this.viewService.addBasemap();
    const catalog = await this.catalogService.buildMapCatalog();
    this.layerService.addCatalogToMap(catalog);
  }
}
