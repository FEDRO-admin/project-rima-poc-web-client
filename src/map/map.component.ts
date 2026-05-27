import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, viewChild, ElementRef, effect, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import { MapViewService } from './view/view.service';
import { CatalogService } from './catalog/catalog.service';
import { LayerService } from './layer/layer.service';
import { LanguageStore } from '../i18n/language.store';
import MapView from '@arcgis/core/views/MapView';
import { MapViewInitialiseError } from './map-errors';
import { ExtentProperties } from '@arcgis/core/geometry/Extent';
import { SpatialReferenceProperties } from '@arcgis/core/geometry/SpatialReference';
import { PopupComponent } from './popup/popup.component';
import { PopupClickService } from './popup/popup-click.service';
import { PopupHighlightService } from './popup/popup-highlight.service';

@Component({
  selector: 'rima-map',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [PopupComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly viewService = inject(MapViewService);
  private readonly catalogService = inject(CatalogService);
  private readonly layerService = inject(LayerService);
  public readonly languageStore = inject(LanguageStore);
  private readonly popupClickService = inject(PopupClickService);
  private readonly popupHighlightService = inject(PopupHighlightService);

  private readonly initializedMapHosts = new WeakSet<HTMLArcgisMapElement>();

  protected readonly spatialReference: SpatialReferenceProperties = { wkid: 2056 };
  protected readonly extent: ExtentProperties = {
    xmin: 2479700,
    xmax: 2840000,
    ymin: 1068000,
    ymax: 1308000,
    spatialReference: this.spatialReference,
  };
  private readonly mapElement = viewChild<ElementRef>('arcgisMap');

  constructor() {
    effect(() => {
      const mapElement = this.mapElement();
      untracked(() => {
        if (mapElement?.nativeElement) {
          const el = mapElement.nativeElement as HTMLArcgisMapElement;
          if (this.initializedMapHosts.has(el)) return;
          this.initializedMapHosts.add(el);

          el.viewOnReady()
            .then(() => this.onViewReady(el.view))
            .catch((error) => {
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
