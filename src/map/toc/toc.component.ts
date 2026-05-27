import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnDestroy, viewChild } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-layer-list';

@Component({
  selector: 'rima-toc',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './toc.component.html',
  styleUrl: './toc.component.scss',
})
export class TocComponent implements AfterViewInit, OnDestroy {
  private readonly layerListElement = viewChild<ElementRef<HTMLArcgisLayerListElement>>('layerList');
  private mapObserver?: MutationObserver;

  public ngAfterViewInit(): void {
    this.connectToMapElement();
  }

  public ngOnDestroy(): void {
    this.mapObserver?.disconnect();
  }

  private connectToMapElement(): void {
    const layerList = this.layerListElement()?.nativeElement;
    if (!layerList) {
      return;
    }

    const mapElement = document.getElementById('main-map') as HTMLArcgisMapElement | null;
    if (mapElement) {
      // Assigning the element reference directly is resilient to route/lifecycle timing.
      layerList.referenceElement = mapElement;
      this.mapObserver?.disconnect();
      return;
    }

    this.mapObserver = new MutationObserver(() => {
      const discoveredMapElement = document.getElementById('main-map') as HTMLArcgisMapElement | null;
      if (!discoveredMapElement) {
        return;
      }

      layerList.referenceElement = discoveredMapElement;
      this.mapObserver?.disconnect();
    });

    this.mapObserver.observe(document.body, { childList: true, subtree: true });
  }
}
