import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, viewChild, ElementRef, effect, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import '@arcgis/map-components/dist/components/arcgis-scene';
import { ViewService } from './view/view.service';
import { RIMA_SWITZERLAND_EXTENT } from './map-constants';
import { TocComponent } from './toc/toc.component';
import { PopupComponent } from './information-pane/popup.component';
import { SceneToggleComponent } from './view/view-toggle/scene-toggle.component';
import { BasemapGalleryComponent } from './view/mapview/basemap-gallery/basemap-gallery.component';
import { ViewStore } from './view/view.store';
import { MapViewService } from './view/mapview/mapview.service';
import { SceneViewService } from './view/sceneview/sceneview.service';
import { HistoryPickerComponent } from './history/history-picker/history-picker.component';

@Component({
  selector: 'rima-map',
  imports: [TocComponent, PopupComponent, SceneToggleComponent, BasemapGalleryComponent, HistoryPickerComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly viewService = inject(ViewService);
  private readonly mapViewInitService = inject(MapViewService);
  private readonly sceneViewInitService = inject(SceneViewService);
  protected readonly viewStore = inject(ViewStore);

  protected readonly switzerlandExtent = RIMA_SWITZERLAND_EXTENT;

  private readonly mapElement = viewChild<ElementRef<HTMLArcgisMapElement>>('arcgisMap');
  private readonly sceneElement = viewChild<ElementRef<HTMLArcgisSceneElement>>('arcgisScene');
  private mapInitialised = false;

  constructor() {
    effect(() => {
      const mapElement = this.mapElement();
      const sceneElement = this.sceneElement();
      untracked(() => {
        if (mapElement?.nativeElement && sceneElement?.nativeElement && !this.mapInitialised) {
          this.mapInitialised = true;
          this.initViews(mapElement.nativeElement, sceneElement.nativeElement);
        }
      });
    });
  }

  private async initViews(mapEl: HTMLArcgisMapElement, sceneEl: HTMLArcgisSceneElement): Promise<void> {
    await this.mapViewInitService.init(mapEl);
    this.viewService.setInitialView(this.mapViewInitService.getMapView()!);
    await this.sceneViewInitService.init(sceneEl);
  }
}
