import { DestroyRef, inject, Injectable, signal } from '@angular/core';
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

@Injectable({
  providedIn: 'root',
})
export class GuidPickerService {
  private readonly viewService = inject(MapViewService);
  private readonly destroyRef = inject(DestroyRef);

  readonly active = signal(false);
  readonly candidates = signal<GuidPickerCandidate[]>([]);
  readonly fieldName = signal<string | undefined>(undefined);

  private clickHandle: { remove(): void } | undefined;
  private resolveSelection: ((value: string | undefined) => void) | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.cancel());
  }

  startPicking(forField: string): Promise<string | undefined> {
    this.cancel();
    this.fieldName.set(forField);
    this.active.set(true);
    this.candidates.set([]);

    const view = this.viewService.mapView();
    if (!view) {
      this.active.set(false);
      return Promise.resolve(undefined);
    }

    return new Promise<string | undefined>((resolve) => {
      this.resolveSelection = resolve;

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
    });
  }

  confirmSelection(candidate: GuidPickerCandidate): void {
    this.resolveSelection?.(candidate.idValue);
    this.cleanup();
  }

  cancel(): void {
    this.resolveSelection?.(undefined);
    this.cleanup();
  }

  private cleanup(): void {
    this.clickHandle?.remove();
    this.clickHandle = undefined;
    this.resolveSelection = undefined;
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
