import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Graphic from '@arcgis/core/Graphic';
import type { GraphicHit } from '@arcgis/core/views/types';
import { MapViewService } from '../view/view.service';

export interface GuidPickerCandidate {
  graphic: Graphic;
  layerTitle: string;
  displayLabel: string;
  idValue: string;
}

export interface GuidPickerResult {
  fieldName: string;
  value: string;
}

@Injectable({
  providedIn: 'root',
})
export class GuidPickerService implements OnDestroy {
  private readonly viewService = inject(MapViewService);

  readonly active = signal(false);
  readonly candidates = signal<GuidPickerCandidate[]>([]);
  readonly fieldName = signal<string | undefined>(undefined);
  readonly lastSelection = signal<GuidPickerResult | undefined>(undefined);

  private clickHandle: { remove(): void } | undefined;

  ngOnDestroy(): void {
    this.cancel();
  }

  startPicking(forField: string): void {
    this.cancel();
    this.fieldName.set(forField);
    this.active.set(true);
    this.candidates.set([]);
    this.lastSelection.set(undefined);

    const view = this.viewService.mapView();
    if (!view) {
      this.active.set(false);
      return;
    }

    this.clickHandle = view.on('click', async (event) => {
      event.stopPropagation();

      const response = await view.hitTest(event, {
        include: view.map!.allLayers.filter((layer) => layer.type === 'feature').toArray() as FeatureLayer[],
      });

      const hits = response.results
        .filter((result): result is GraphicHit => result.type === 'graphic')
        .map((result) => result.graphic);

      if (hits.length === 0) return;

      const candidates = hits.map((graphic) => this.buildCandidate(graphic));
      this.candidates.set(candidates);
    });
  }

  confirmSelection(candidate: GuidPickerCandidate): void {
    const field = this.fieldName();
    if (field) {
      this.lastSelection.set({ fieldName: field, value: candidate.idValue });
    }
    this.cleanup();
  }

  cancel(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.clickHandle?.remove();
    this.clickHandle = undefined;
    this.active.set(false);
    this.candidates.set([]);
    this.fieldName.set(undefined);
  }

  private buildCandidate(graphic: Graphic): GuidPickerCandidate {
    const layer = graphic.layer as FeatureLayer;
    const layerTitle = layer?.title ?? 'Unknown Layer';

    const idField = layer?.fields?.find((f) => f.type === 'global-id' || f.name.toLowerCase() === 'id');
    const idValue = idField
      ? String(graphic.attributes[idField.name] ?? '')
      : String(graphic.attributes[layer?.objectIdField] ?? '');

    const displayLabel = this.buildDisplayLabel(graphic, layer);

    return { graphic, layerTitle, displayLabel, idValue };
  }

  private buildDisplayLabel(graphic: Graphic, layer: FeatureLayer): string {
    if (!layer?.fields || !graphic.attributes) return 'Feature';

    const displayField = layer.displayField;
    if (displayField && graphic.attributes[displayField] != null) {
      return String(graphic.attributes[displayField]);
    }

    const stringField = layer.fields.find(
      (f) =>
        f.type === 'string' &&
        f.name !== layer.objectIdField &&
        graphic.attributes[f.name] != null &&
        graphic.attributes[f.name] !== '',
    );
    if (stringField) {
      return String(graphic.attributes[stringField.name]);
    }

    return `OID: ${graphic.attributes[layer.objectIdField] ?? 'unknown'}`;
  }
}
