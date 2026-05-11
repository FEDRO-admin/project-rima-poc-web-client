import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import '@arcgis/map-components/dist/components/arcgis-search';

@Component({
  selector: 'rima-search',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  private readonly searchElement = viewChild<ElementRef<HTMLArcgisSearchElement>>('arcgisSearch');
  private readonly translocoService = inject(TranslocoService);

  private readonly placeholder = toSignal(this.translocoService.selectTranslate('search.placeholder'), {
    initialValue: '',
  });

  constructor() {
    effect(() => {
      // get the esri search element
      const searchElement = this.searchElement()?.nativeElement;
      // if the element is not yet available, do nothing
      if (!searchElement) return;

      // wait for exri event that fires when the search element is ready
      searchElement.addEventListener('arcgisPropertyChange', () => {
        if (searchElement.state === 'ready') {
          // once ready, apply translated placeholder
          this.applyPlaceholder(searchElement);
        }
      });
    });

    // Re-apply placeholder on language change
    effect(() => {
      // get search element
      const searchElement = this.searchElement()?.nativeElement;
      // get current placeholder
      const placeholder = this.placeholder();
      // if element or placeholder missing, or state not ready, do nothing
      if (!searchElement || !placeholder || searchElement.state !== 'ready') return;
      // else, apply the new placeholder
      this.applyPlaceholder(searchElement);
    });
  }

  // apply the translated placeholder to the search element
  private applyPlaceholder(searchElement: HTMLArcgisSearchElement): void {
    const placeholder = this.placeholder();
    if (!placeholder) return;

    // set the main placeholder
    searchElement.allPlaceholder = placeholder;
    // if there are multiple sources, set the placeholder for each source as well
    // TODO: not sure why this works yet, figure out...
    searchElement.allSources?.forEach((source) => {
      source.placeholder = placeholder;
    });
  }
}
