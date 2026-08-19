import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-basemap-gallery';
import '@esri/calcite-components/dist/components/calcite-icon';
import LocalBasemapsSource from '@arcgis/core/widgets/BasemapGallery/support/LocalBasemapsSource';
import { BasemapService } from '../basemap.service';
import { ViewService, RimaView } from '../../view.service';

@Component({
  selector: 'rima-basemap-gallery',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './basemap-gallery.component.html',
  styleUrl: './basemap-gallery.component.scss',
})
export class BasemapGalleryComponent {
  private readonly basemapService = inject(BasemapService);
  private readonly viewService = inject(ViewService);
  protected readonly open = signal(false);

  private readonly galleryElement = viewChild<ElementRef<HTMLArcgisBasemapGalleryElement>>('gallery');

  constructor() {
    this.wireGallery();
  }

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  private wireGallery(): void {
    effect(() => {
      const el = this.galleryElement()?.nativeElement;
      const view = this.viewService.activeView();
      untracked(() => {
        if (el && view) this.updateGallerySource(el, view);
      });
    });
  }

  private async updateGallerySource(el: HTMLArcgisBasemapGalleryElement, view: RimaView): Promise<void> {
    const basemaps = await this.basemapService.createFreshBasemaps();
    el.view = view;
    el.source = new LocalBasemapsSource({ basemaps });
  }
}
