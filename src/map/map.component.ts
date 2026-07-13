import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, viewChild, ElementRef, effect, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import '@arcgis/map-components/dist/components/arcgis-scene';
import { MapViewService } from './view/view.service';
import { CatalogService } from './catalog/catalog.service';
import { RIMA_SWITZERLAND_EXTENT } from './map-constants';
import { LayerService } from './layer/layer.service';
import { TocComponent } from './toc/toc.component';
import { ViewInitialisationError } from './view/view-errors';
import { SceneViewInitialisationError } from './scene/scene-errors';
import { PopupComponent } from './popup/popup.component';
import { CreateFormComponent } from './create/create-form/create-form.component';
import { EditFormComponent } from './edit/edit-form/edit-form.component';
import { SceneToggleComponent } from './scene/scene-toggle/scene-toggle.component';
import { SceneStore } from './scene/scene.store';

@Component({
  selector: 'rima-map',
  imports: [TocComponent, PopupComponent, CreateFormComponent, EditFormComponent, SceneToggleComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly viewService = inject(MapViewService);
  private readonly catalogService = inject(CatalogService);
  private readonly layerService = inject(LayerService);
  protected readonly sceneStore = inject(SceneStore);

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
          this.initMap(mapElement.nativeElement, sceneElement.nativeElement);
        }
      });
    });
  }

  private async initMap(mapEl: HTMLArcgisMapElement, sceneEl: HTMLArcgisSceneElement): Promise<void> {
    const view = mapEl.view;
    if (!view) {
      throw new ViewInitialisationError('MapView is not available on the arcgis-map element');
    }
    await this.viewService.registerMapView(view);
    this.viewService.addBasemap();
    await view.when();
    const catalog = await this.catalogService.buildMapCatalog();
    this.layerService.addCatalogToMap(catalog);

    await this.initScene(sceneEl);
  }

  private async initScene(sceneEl: HTMLArcgisSceneElement): Promise<void> {
    await sceneEl.viewOnReady();

    const sceneView = sceneEl.view;
    if (!sceneView) {
      throw new SceneViewInitialisationError('SceneView is not available on the arcgis-scene element');
    }

    this.viewService.registerSceneView(sceneView);
  }
}
