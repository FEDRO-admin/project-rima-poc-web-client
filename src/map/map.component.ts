import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, viewChild, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import Basemap from '@arcgis/core/Basemap';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import { ExtentProperties } from '@arcgis/core/geometry/Extent';
import { SpatialReferenceProperties } from '@arcgis/core/geometry/SpatialReference';
import { MapLoadError } from './map-error';
import { SearchComponent } from '../search/search.component';
import { LayersStore } from '../stores/layers.store';

@Component({
  selector: 'rima-map',
  imports: [SearchComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly layersStore = inject(LayersStore);

  protected readonly mapElement = viewChild<ElementRef<HTMLArcgisMapElement>>('arcgisMap');

  protected readonly spatialReference: SpatialReferenceProperties = { wkid: 2056 };
  protected readonly extent: ExtentProperties = {
    xmin: 2479700,
    xmax: 2840000,
    ymin: 1068000,
    ymax: 1308000,
    spatialReference: this.spatialReference,
  };

  constructor() {
    effect(() => {
      const mapRef = this.mapElement();
      untracked(() => {
        if (mapRef?.nativeElement) {
          void this.initializeMap(mapRef.nativeElement);
        }
      });
    });

    effect(() => {
      const mapImageLayer = this.layersStore.mapImageLayer();
      const mapRef = this.mapElement();
      if (!mapImageLayer || !mapRef?.nativeElement?.view?.map) return;
      mapRef.nativeElement.view.map.add(mapImageLayer);
    });
  }

  private async initializeMap(mapElement: HTMLArcgisMapElement): Promise<void> {
    await mapElement.viewOnReady();
    if (!mapElement.view.map) {
      throw new MapLoadError();
    }

    const swisstopoLayer = new WMTSLayer({
      url: 'https://wmts.geo.admin.ch/EPSG/2056/1.0.0/WMTSCapabilities.xml',
      activeLayer: {
        id: 'ch.swisstopo.pixelkarte-farbe',
      },
    });
    const swisstopoBasemap = new Basemap({
      baseLayers: [swisstopoLayer],
      title: 'Pixelkarte Farbig',
      id: 'swisstopo',
    });
    mapElement.view.map.basemap = swisstopoBasemap;
  }
}
