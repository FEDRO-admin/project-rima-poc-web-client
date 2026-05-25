import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, viewChild, ElementRef, effect, untracked } from '@angular/core';
import '@arcgis/map-components/dist/components/arcgis-map';
import { MapViewService } from './view/view.service';
import { CatalogService } from './catalog/catalog.service';
import { LanguageStore } from '../i18n/language.store';
import MapView from '@arcgis/core/views/MapView';
import { MapViewInitialiseError } from './map-errors';
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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent {
  private readonly viewService = inject(MapViewService);
  private readonly catalogService = inject(CatalogService);
  public readonly languageStore = inject(LanguageStore);

  private readonly initializedMapHosts = new WeakSet<HTMLArcgisMapElement>();

  protected readonly spatialReference: SpatialReferenceProperties = { wkid: 2056 };
  protected readonly extent: ExtentProperties = {
    xmin: 2479700,
    xmax: 2840000,
    ymin: 1068000,
    ymax: 1308000,
    spatialReference: this.spatialReference,
  };
  private readonly mapElement = viewChild<ElementRef>('arcgisMap');

  constructor() {
    effect(() => {
      const mapElement = this.mapElement();
      untracked(() => {
        if (mapElement?.nativeElement) {
          const view = mapElement.nativeElement.view as MapView;
          this.onViewReady(view).catch((error) => {
            throw new MapViewInitialiseError(error instanceof Error ? error.message : String(error));
          });
        }
      });
    });
  }

  protected async onViewReady(view: MapView): Promise<void> {
    await this.viewService.registerMapView(view);
    await this.viewService.addBasemap();
    await this.catalogService.buildMapCatalog();
  }
}
