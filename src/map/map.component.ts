import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, ElementRef, viewChild, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import Basemap from '@arcgis/core/Basemap';
import WMSLayer from '@arcgis/core/layers/WMSLayer';
import WMTSLayer from '@arcgis/core/layers/WMTSLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GroupLayer from '@arcgis/core/layers/GroupLayer';
import { ExtentProperties } from '@arcgis/core/geometry/Extent';
import { SpatialReferenceProperties } from '@arcgis/core/geometry/SpatialReference';
import { MapLoadError } from './map-error';

/** ArcGIS Living Atlas — Europe NUTS 3 demographics & boundaries (Web Mercator; projects onto LV95 map). */
const ESRI_EUROPE_NUTS_3_DEMOGRAPHICS_URL =
  'https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/Europe_NUTS_3_Demographics_and_Boundaries/FeatureServer/0';
const ESRI_WORLD_URBAN_AREAS_URL =
  'https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/World_Urban_Areas/FeatureServer/0';
const SWISSTOPO_WMTS_CAPABILITIES_URL = 'https://wmts.geo.admin.ch/EPSG/2056/1.0.0/WMTSCapabilities.xml';
const SWISSTOPO_WMTS_PIXELKARTE_LAYER_ID = 'ch.swisstopo.pixelkarte-farbe';
const SWISSTOPO_WMS_URL = 'https://wms.geo.admin.ch/';
const SWISSTOPO_WMS_BAULINIEN_LAYER_NAME = 'ch.astra.baulinien-nationalstrassen';
const SWISSTOPO_WMS_ACHSEN_LAYER_NAME = 'ch.astra.nationalstrassenachsen';
const RIMA_ACHSEN_FEATURESERVICE_URL =
  'https://rima-poc.switzerlandnorth.cloudapp.azure.com/arcgis/rest/services/NewFolder/Achsen_Test2/FeatureServer';

@Component({
  selector: 'rima-map',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  protected readonly mapElement = viewChild<ElementRef<HTMLArcgisMapElement>>('arcgisMap');

  private readonly initializedMapHosts = new WeakSet<HTMLArcgisMapElement>();

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
    if (this.initializedMapHosts.has(mapElement)) {
      return;
    }

    await mapElement.viewOnReady();
    if (!mapElement.view.map) {
      throw new MapLoadError();
    }

    const swisstopoLayer = new WMTSLayer({
      url: SWISSTOPO_WMTS_CAPABILITIES_URL,
      activeLayer: {
        id: SWISSTOPO_WMTS_PIXELKARTE_LAYER_ID,
      },
      opacity: 0.5,
    });
    const swisstopoBasemap = new Basemap({
      baseLayers: [swisstopoLayer],
      title: 'Pixelkarte Farbig',
      id: 'swisstopo',
    });
    mapElement.view.map.basemap = swisstopoBasemap;

    const sampleGroup = new GroupLayer({
      title: 'Group Layer',
      visibilityMode: 'independent',
      //visibility: true,
      listMode: 'show',
      layers: [
        new FeatureLayer({
          title: 'Europe NUTS 3 demographics & boundaries',
          url: ESRI_EUROPE_NUTS_3_DEMOGRAPHICS_URL,
          opacity: 0.5,
          visible: false,
          listMode: 'show',
        }),
        new FeatureLayer({
          title: 'World urban areas',
          url: ESRI_WORLD_URBAN_AREAS_URL,
          listMode: 'show',
        }),
        new WMSLayer({
          title: 'Baulinien WMS',
          url: SWISSTOPO_WMS_URL,
          sublayers: [{ name: SWISSTOPO_WMS_BAULINIEN_LAYER_NAME, title: 'Baulinien Nationalstrassen' }],
          listMode: 'show',
        }),
      ],
    });
    mapElement.view.map.add(sampleGroup);

    const axisWms = new WMSLayer({
      title: 'Achsen WMS',
      url: SWISSTOPO_WMS_URL,
      sublayers: [{ name: SWISSTOPO_WMS_ACHSEN_LAYER_NAME, title: 'National Strassen Achsen' }],
      listMode: 'show',
    });
    mapElement.view.map.add(axisWms);

    const achsenLayer = new FeatureLayer({
      title: 'Achsen (RIMA POC)',
      url: RIMA_ACHSEN_FEATURESERVICE_URL,
      listMode: 'show',
    });
    mapElement.view.map.add(achsenLayer);

    this.initializedMapHosts.add(mapElement);
  }
}
