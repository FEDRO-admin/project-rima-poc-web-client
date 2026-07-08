import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, viewChild, ElementRef, effect, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import { MapViewService } from './view/view.service';
import { WebmapService } from './webmap/webmap.service';
import { RIMA_SWITZERLAND_EXTENT } from './map-constants';
import { TocComponent } from './toc/toc.component';
import { ViewInitialisationError } from './view/view-errors';
import { PopupComponent } from './popup/popup.component';
import { CreateFormComponent } from './create/create-form/create-form.component';
import { EditFormComponent } from './edit/edit-form/edit-form.component';

@Component({
  selector: 'rima-map',
  imports: [TocComponent, PopupComponent, CreateFormComponent, EditFormComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly viewService = inject(MapViewService);
  private readonly webmapService = inject(WebmapService);

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

    const webMap = await this.webmapService.loadWebMap();
    view.map = webMap;
    this.viewService.addBasemap();

    await view.when();
  }
}
