import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import '@arcgis/map-components/dist/components/arcgis-search';
import { LayersStore } from '../stores/layers.store';

@Component({
  selector: 'rima-search',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  private readonly searchElement = viewChild<ElementRef<HTMLArcgisSearchElement>>('arcgisSearch');
  private readonly translocoService = inject(TranslocoService);
  private readonly layersStore = inject(LayersStore);

  private readonly placeholder = toSignal(this.translocoService.selectTranslate('search.placeholder'), {
    initialValue: '',
  });

  constructor() {
    effect(() => {
      const searchElement = this.searchElement()?.nativeElement;
      if (!searchElement) return;

      // Add feature layers as search sources
      searchElement.sources = this.layersStore.searchSources() as unknown as typeof searchElement.sources;

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
