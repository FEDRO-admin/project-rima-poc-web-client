import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import '@arcgis/map-components/dist/components/arcgis-search';
import LayerSearchSource from '@arcgis/core/widgets/Search/LayerSearchSource';
import { RimaLayersService } from '../map/layers/rima-layers.service';

@Component({
  selector: 'rima-search',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  private readonly searchElement = viewChild<ElementRef<HTMLArcgisSearchElement>>('arcgisSearch');
  private readonly translocoService = inject(TranslocoService);
  private readonly rimaLayers = inject(RimaLayersService);

  private readonly placeholder = toSignal(this.translocoService.selectTranslate('search.placeholder'), {
    initialValue: '',
  });

  constructor() {
    effect(() => {
      const searchElement = this.searchElement()?.nativeElement;
      if (!searchElement) return;

      // Add feature layers as search sources
      searchElement.sources = this.rimaLayers.all
        .filter((config) => config.search)
        .map(
          (config) => new LayerSearchSource({ ...config.search, layer: config.layer }),
        ) as unknown as typeof searchElement.sources;

      searchElement.addEventListener('arcgisPropertyChange', () => {
        if (searchElement.state === 'ready') {
          this.applyPlaceholder(searchElement);
        }
      });
    });

    // Re-apply placeholder on language change
    effect(() => {
      const searchElement = this.searchElement()?.nativeElement;
      const placeholder = this.placeholder();
      if (!searchElement || !placeholder || searchElement.state !== 'ready') return;
      this.applyPlaceholder(searchElement);
    });
  }

  private applyPlaceholder(searchElement: HTMLArcgisSearchElement): void {
    const placeholder = this.placeholder();
    if (!placeholder) return;

    searchElement.allPlaceholder = placeholder;
    searchElement.allSources?.forEach((source) => {
      source.placeholder = placeholder;
    });
  }
}
