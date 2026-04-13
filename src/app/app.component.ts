import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, signal, viewChild, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import '@arcgis/map-components/dist/components/arcgis-map';
import Basemap from '@arcgis/core/Basemap';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import { ExtentProperties } from '@arcgis/core/geometry/Extent';
import { SpatialReferenceProperties } from '@arcgis/core/geometry/SpatialReference';

@Component({
  selector: 'rima-root',
  imports: [RouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly title = signal('project-rima-poc-web-client');
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
  }

  private async initializeMap(mapElement: HTMLArcgisMapElement): Promise<void> {
    await mapElement.viewOnReady();
    if (!mapElement.view.map) {
      console.error('Map view is not available');
      return;
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

    const mapImageLayer = new MapImageLayer({
      url: 'https://rima-poc.switzerlandnorth.cloudapp.azure.com/arcgis/rest/services/Achsen_Test/MapServer',
    });
    mapElement.view.map.add(mapImageLayer);
  }
}
