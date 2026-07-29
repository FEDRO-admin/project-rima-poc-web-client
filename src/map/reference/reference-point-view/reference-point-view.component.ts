import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-icon';
import { ReferencePointViewService } from './reference-point-view.service';
import { resolveFieldDisplayValue } from '../../layer/layer-attribute-domain-resolver';
import { isImmutableField } from '../../layer/layer-attributes';
import type {
  ReferencePoint,
  ReferencePointRelationshipInfo,
  ReferencePointType,
  AttributeValue,
} from '../reference-point-types';

interface FieldEntry {
  label: string;
  value: AttributeValue;
}

@Component({
  selector: 'rima-reference-point-view',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './reference-point-view.component.html',
  styleUrl: './reference-point-view.component.scss',
})
export class ReferencePointViewComponent {
  readonly graphic = input.required<Graphic>();
  readonly type = input.required<ReferencePointType>();

  private readonly service = inject(ReferencePointViewService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly writableRelationship = signal<ReferencePointRelationshipInfo | undefined>(undefined);
  private readonly writablePoints = signal<ReferencePoint[]>([]);
  private readonly writableLoading = signal(false);

  protected readonly relationship = this.writableRelationship.asReadonly();
  protected readonly points = this.writablePoints.asReadonly();
  protected readonly loading = this.writableLoading.asReadonly();

  private readonly highlightedGraphics = new Map<string, Graphic>();

  protected readonly title = computed(() => {
    return this.type() === 'von' ? 'Von Punkte' : 'Bis Punkte';
  });

  constructor() {
    this.loadOnGraphicChange();

    this.destroyRef.onDestroy(() => {
      this.clearHighlights();
    });
  }

  protected isHighlighted(clientId: string): boolean {
    return this.highlightedGraphics.has(clientId);
  }

  protected toggleHighlight(point: ReferencePoint): void {
    const existing = this.highlightedGraphics.get(point.clientId);
    if (existing) {
      this.service.unhighlightPoint(existing);
      this.highlightedGraphics.delete(point.clientId);
    } else {
      const handle = this.service.highlightPoint(point, this.type());
      this.highlightedGraphics.set(point.clientId, handle);
    }
  }

  protected getPointLabel(point: ReferencePoint): string {
    const rbbs = point.attributes['rbbs'];
    if (rbbs != null && rbbs !== '') return String(rbbs);
    return 'Point';
  }

  protected getDisplayFields(point: ReferencePoint): FieldEntry[] {
    const rel = this.relationship();
    if (!rel?.relatedLayer?.fields?.length) return [];

    return rel.relatedLayer.fields
      .filter((field) => !isImmutableField(field.name, rel.relatedLayer))
      .map((field) => ({
        label: field.alias || field.name,
        value: resolveFieldDisplayValue(
          new Graphic({ attributes: point.attributes, layer: rel.relatedLayer }),
          field,
          point.attributes[field.name],
        ),
      }));
  }

  private loadOnGraphicChange(): void {
    effect(() => {
      const graphic = this.graphic();
      const type = this.type();
      untracked(() => {
        this.clearHighlights();
        this.writablePoints.set([]);
        this.writableRelationship.set(undefined);
        this.writableLoading.set(false);

        const layer = graphic.layer;
        if (!(layer instanceof FeatureLayer)) return;

        const rel = this.service.resolveRelationship(layer, type);
        if (!rel) return;

        this.writableRelationship.set(rel);
        this.writableLoading.set(true);

        this.service.loadPoints(layer, graphic, rel.relationshipId).then(
          (points) => {
            this.writablePoints.set(points);
            this.writableLoading.set(false);
          },
          () => {
            this.writableLoading.set(false);
          },
        );
      });
    });
  }

  private clearHighlights(): void {
    for (const graphic of this.highlightedGraphics.values()) {
      this.service.unhighlightPoint(graphic);
    }
    this.highlightedGraphics.clear();
  }
}
