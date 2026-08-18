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
import { ViewService } from '../../view.service';
import { ViewStore } from '../../view.store';

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
  protected readonly viewStore = inject(ViewStore);
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
      untracked(() => {
        if (!el) return;
        const view = this.viewService.activeView();
        const basemaps = this.basemapService.basemaps();
        if (!view || basemaps.length === 0) return;

        el.view = view;
        el.source = new LocalBasemapsSource({ basemaps });
      });
    });
  }
}
