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
import { ViewService } from '../../view.service';

@Component({
  selector: 'rima-basemap-gallery',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './basemap-gallery.component.html',
  styleUrl: './basemap-gallery.component.scss',
})
export class BasemapGalleryComponent {
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
        if (el && view) el.view = view;
      });
    });
  }
}
