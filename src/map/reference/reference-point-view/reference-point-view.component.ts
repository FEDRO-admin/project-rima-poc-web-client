import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  inject,
  input,
  OnDestroy,
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
export class ReferencePointViewComponent implements OnDestroy {
  readonly graphic = input.required<Graphic>();
  readonly type = input.required<ReferencePointType>();

  private readonly service = inject(ReferencePointViewService);

  private readonly writableRelationship = signal<ReferencePointRelationshipInfo | undefined>(undefined);
  private readonly writablePoints = signal<ReferencePoint[]>([]);
  private readonly writableLoading = signal(false);

  protected readonly relationship = this.writableRelationship.asReadonly();
  protected readonly points = this.writablePoints.asReadonly();
  protected readonly loading = this.writableLoading.asReadonly();

  private readonly highlightedGraphics = new Map<string, Graphic>();
  private readonly writableHighlightedIds = signal(new Set<string>());
  protected readonly highlightedIds = this.writableHighlightedIds.asReadonly();

  protected readonly title = computed(() => {
    return this.type() === 'von' ? 'Von Punkte' : 'Bis Punkte';
  });

  protected readonly allHighlighted = computed(() => {
    const pts = this.points();
    const ids = this.highlightedIds();
    return pts.length > 0 && pts.every((p) => ids.has(p.clientId));
  });

  constructor() {
    this.loadOnGraphicChange();
  }

  ngOnDestroy(): void {
    this.clearHighlights();
  }

  protected isHighlighted(clientId: string): boolean {
    return this.highlightedIds().has(clientId);
  }

  protected toggleAllHighlights(): void {
    const pts = this.points();
    if (this.allHighlighted()) {
      this.clearHighlights();
    } else {
      for (const point of pts) {
        if (!this.highlightedGraphics.has(point.clientId)) {
          const handle = this.service.highlightPoint(point, this.type());
          this.highlightedGraphics.set(point.clientId, handle);
        }
      }
      this.writableHighlightedIds.set(new Set(this.highlightedGraphics.keys()));
    }
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
    this.writableHighlightedIds.set(new Set(this.highlightedGraphics.keys()));
  }

  protected getPointLabel(point: ReferencePoint): string {
    const rbbs = point.attributes['rbbs'];
    if (rbbs != null && rbbs !== '') return String(rbbs);
    return 'Point';
  }

  protected getDisplayFields(point: ReferencePoint): FieldEntry[] {
    const relatedLayer = this.relationship()?.relatedLayer;
    if (!relatedLayer?.fields?.length) return [];

    const graphic = new Graphic({ attributes: point.attributes, layer: relatedLayer });
    const editableFields = relatedLayer.fields.filter((field) => !isImmutableField(field.name, relatedLayer));

    return editableFields.map((field) => ({
      label: field.alias || field.name,
      value: resolveFieldDisplayValue(graphic, field, point.attributes[field.name]),
    }));
  }

  private loadOnGraphicChange(): void {
    effect(() => {
      const graphic = this.graphic();
      const type = this.type();
      untracked(() => {
        this.loadReferencePoints(graphic, type);
      });
    });
  }

  private async loadReferencePoints(graphic: Graphic, type: ReferencePointType): Promise<void> {
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

    try {
      const points = await this.service.loadPoints(layer, graphic, rel.relationshipId, rel.relatedLayer);
      this.writablePoints.set(points);
    } finally {
      this.writableLoading.set(false);
    }
  }

  private clearHighlights(): void {
    for (const graphic of this.highlightedGraphics.values()) {
      this.service.unhighlightPoint(graphic);
    }
    this.highlightedGraphics.clear();
    this.writableHighlightedIds.set(new Set());
  }
}
