import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, viewChild, ElementRef, effect, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import { MapViewService } from './view/view.service';
import { CatalogService } from './catalog/catalog.service';
import { LanguageStore } from '../i18n/language.store';
import MapView from '@arcgis/core/views/MapView';
import { MapViewInitialiseError } from './map-errors';

@Component({
  selector: 'rima-map',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly viewService = inject(MapViewService);
  private readonly catalogService = inject(CatalogService);
  public readonly languageStore = inject(LanguageStore);

  private readonly mapElement = viewChild<ElementRef>('arcgisMap');

  constructor() {
    effect(() => {
      const mapElement = this.mapElement();
      untracked(() => {
        if (mapElement?.nativeElement) {
          const view = mapElement.nativeElement.view as MapView;
          this.onViewReady(view).catch((error) => {
            throw new MapViewInitialiseError(error instanceof Error ? error.message : String(error));
          });
        }
      });
    });
  }

  protected async onViewReady(view: MapView): Promise<void> {
    await this.viewService.registerMapView(view);
    await this.viewService.addBasemap();
    await this.catalogService.buildMapCatalog();
  }
}
