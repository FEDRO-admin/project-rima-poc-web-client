import { inject, Injectable, OnDestroy } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import type Point from '@arcgis/core/geometry/Point';
import { DocumentGeometryStore } from './document-geometry.store';
import { DocumentsStore } from './documents.store';
import { DocumentRecord } from './document-types';
import { DOCUMENT_POINT_SYMBOL, DOCUMENT_POINT_PLACING_SYMBOL } from './document-geometry-config';
import { ViewService } from '../../view/view.service';
import { ViewStore } from '../../view/view.store';
import { buildSnappingSources, cleanupSketchResources } from '../../shared/sketch-utils';

@Injectable()
export class DocumentGeometryService implements OnDestroy {
  private readonly geometryStore = inject(DocumentGeometryStore);
  private readonly documentsStore = inject(DocumentsStore);
  private readonly viewService = inject(ViewService);
  private readonly viewStore = inject(ViewStore);

  private displayLayer: GraphicsLayer | undefined;
  private sketchViewModel: SketchViewModel | undefined;
  private sketchLayer: GraphicsLayer | undefined;
  private eventHandle: { remove(): void } | undefined;

  ngOnDestroy(): void {
    this.cleanup();
  }

  // --- Display ---

  refreshDisplayLayer(): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    if (!this.geometryStore.displayVisible()) {
      this.removeDisplayLayer();
      return;
    }

    const hiddenIds = this.geometryStore.hiddenDocumentIds();
    const graphics = this.documentsStore
      .documents()
      .filter((d) => d.geometry && !hiddenIds.includes(d.objectId))
      .map((d) => new Graphic({ geometry: d.geometry, symbol: DOCUMENT_POINT_SYMBOL }));

    if (!this.displayLayer) {
      this.displayLayer = new GraphicsLayer({ listMode: 'hide', title: 'Dokument-Punkte' });
      view.map.add(this.displayLayer);
    }

    this.displayLayer.removeAll();
    this.displayLayer.addMany(graphics);
  }

  toggleDisplay(): void {
    const visible = !this.geometryStore.displayVisible();
    this.geometryStore.setDisplayVisible(visible);
    if (visible) {
      this.refreshDisplayLayer();
    } else {
      this.removeDisplayLayer();
    }
  }

  toggleDocumentVisibility(objectId: number): void {
    this.geometryStore.toggleDocumentHidden(objectId);
    this.refreshDisplayLayer();
  }

  isDocumentHidden(objectId: number): boolean {
    return this.geometryStore.hiddenDocumentIds().includes(objectId);
  }

  hasDocumentsWithGeometry(): boolean {
    return this.documentsStore.documents().some((d) => !!d.geometry);
  }

  // --- Geometry Placement ---

  startPlacing(): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.cleanupSketch();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      pointSymbol: DOCUMENT_POINT_PLACING_SYMBOL,
      snappingOptions: {
        enabled: true,
        featureSources: buildSnappingSources(view.map),
      },
    });

    this.eventHandle = this.sketchViewModel.on('create', (event) => {
      if (event.state === 'complete' && event.graphic?.geometry) {
        const point = event.graphic.geometry as Point;
        this.geometryStore.setPlacedGeometry(point);
        this.viewStore.setSketchActive(false);
        this.cleanupSketch();
      }
    });

    this.sketchViewModel.create('point');
    this.geometryStore.setPlacingActive(true);
    this.viewStore.setSketchActive(true);
  }

  startAdjusting(geometry: Point): void {
    const view = this.viewService.activeView();
    if (!view?.map) return;

    this.cleanupSketch();

    this.sketchLayer = new GraphicsLayer({ listMode: 'hide' });
    view.map.add(this.sketchLayer);

    const graphic = new Graphic({
      geometry: geometry.clone(),
      symbol: DOCUMENT_POINT_PLACING_SYMBOL,
    });
    this.sketchLayer.add(graphic);

    this.sketchViewModel = new SketchViewModel({
      view,
      layer: this.sketchLayer,
      updateOnGraphicClick: false,
      snappingOptions: {
        enabled: true,
        featureSources: buildSnappingSources(view.map),
      },
    });

    this.eventHandle = this.sketchViewModel.on('update', (event) => {
      if (event.state === 'active' || event.state === 'complete') {
        const updatedGeometry = event.graphics[0]?.geometry as Point;
        if (updatedGeometry) {
          this.geometryStore.setPlacedGeometry(updatedGeometry);
        }
      }
      if (event.state === 'complete') {
        this.viewStore.setSketchActive(false);
        this.cleanupSketch();
      }
    });

    this.sketchViewModel.update(graphic, { tool: 'move' });
    this.viewStore.setSketchActive(true);
  }

  cancelPlacing(): void {
    this.cleanupSketch();
    this.viewStore.setSketchActive(false);
    this.geometryStore.setPlacedGeometry(undefined);
    this.geometryStore.setPlacingActive(false);
  }

  clearPlacedGeometry(): void {
    this.geometryStore.setPlacedGeometry(undefined);
  }

  // --- Cleanup ---

  cleanup(): void {
    this.cleanupSketch();
    this.removeDisplayLayer();
    this.geometryStore.reset();
  }

  private cleanupSketch(): void {
    this.eventHandle?.remove();
    this.eventHandle = undefined;

    const view = this.viewService.activeView();
    const cleaned = cleanupSketchResources(this.sketchViewModel, this.sketchLayer, view);
    this.sketchViewModel = cleaned.sketchViewModel;
    this.sketchLayer = cleaned.sketchLayer;
  }

  private removeDisplayLayer(): void {
    const view = this.viewService.activeView();
    if (this.displayLayer && view?.map) {
      view.map.remove(this.displayLayer);
      this.displayLayer.destroy();
    }
    this.displayLayer = undefined;
  }
}
