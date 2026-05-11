import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, inject, viewChild, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import Basemap from '@arcgis/core/Basemap';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import { ExtentProperties } from '@arcgis/core/geometry/Extent';
import { SpatialReferenceProperties } from '@arcgis/core/geometry/SpatialReference';
import { MapLoadError } from './map-error';
import { SearchComponent } from '../search/search.component';
import { RimaLayersService } from './layers/rima-layers.service';

@Component({
  selector: 'rima-map',
  imports: [SearchComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly rimaLayers = inject(RimaLayersService);

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

    // this now gets all the layers defined in the RimaLayersService and adds them to the map. In the future we might want to have different sets of layers (e.g. for different languages) and then we could easily switch between them here.
    this.rimaLayers.all.forEach((config) => mapElement.view.map!.add(config.layer));
  }
}
