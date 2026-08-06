import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, input } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { GraphicLayer } from '@arcgis/core/Graphic';
import '@esri/calcite-components/dist/components/calcite-icon';
import { isImmutableField } from '../../../layer/layer-attributes';
import { resolveFieldDisplayValue } from '../../../layer/layer-attribute-domain-resolver';
import { isLayerEditable, isLayerDeletable } from '../../../layer/layer-capabilities';
import { ViewStore } from '../../../view/view.store';
import { ViewService } from '../../../view/view.service';
import { EditService } from '../../../edit/edit.service';
import { DeleteService } from '../../../delete/delete.service';
import { ActionBarComponent } from '../../../../shared/action-bar/action-bar.component';
import { ActionBarButtonComponent } from '../../../../shared/action-bar/action-bar-button.component';

type AttributeValue = string | number | boolean | null;

interface FieldEntry {
  label: string;
  value: AttributeValue;
}

@Component({
  selector: 'rima-attributes-tab',
  imports: [ActionBarComponent, ActionBarButtonComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './attributes-tab.component.html',
  styleUrl: './attributes-tab.component.scss',
})
export class AttributesTabComponent {
  readonly graphic = input.required<Graphic>();

  private readonly viewStore = inject(ViewStore);
  private readonly viewService = inject(ViewService);
  private readonly editService = inject(EditService);
  private readonly deleteService = inject(DeleteService);

  protected readonly isEditable = computed(() => {
    if (this.viewStore.locked() || this.viewStore.historic()) return false;
    return isLayerEditable(this.graphic());
  });

  protected readonly isDeletable = computed(() => {
    if (this.viewStore.locked() || this.viewStore.historic()) return false;
    return isLayerDeletable(this.graphic());
  });

  readonly fields = computed<FieldEntry[]>(() => {
    const graphic: Graphic = this.graphic();
    const layer: GraphicLayer | null | undefined = graphic.layer;
    const attrs: Record<string, AttributeValue> = graphic.attributes ?? {};

    if (layer instanceof FeatureLayer && layer.fields?.length) {
      return layer.fields
        .filter((field) => !isImmutableField(field.name, layer))
        .map((field) => ({
          label: field.alias || field.name,
          value: resolveFieldDisplayValue(graphic, field, attrs[field.name]),
        }));
    }

    return Object.entries(attrs).map(([key, value]) => ({ label: key, value }));
  });

  readonly immutableFields = computed<FieldEntry[]>(() => {
    const graphic: Graphic = this.graphic();
    const layer: GraphicLayer | null | undefined = graphic.layer;
    const attrs: Record<string, AttributeValue> = graphic.attributes ?? {};

    if (layer instanceof FeatureLayer && layer.fields?.length) {
      return layer.fields
        .filter((field) => isImmutableField(field.name, layer))
        .map((field) => ({
          label: field.alias || field.name,
          value: resolveFieldDisplayValue(graphic, field, attrs[field.name]),
        }));
    }

    return [];
  });

  protected zoomTo(): void {
    const graphic = this.graphic();
    const view = this.viewService.activeView();
    if (!graphic.geometry || !view) return;
    view.goTo({ target: graphic.geometry, zoom: 15 });
  }

  protected startEdit(): void {
    this.editService.activate(this.graphic());
  }

  protected startDelete(): void {
    this.deleteService.requestDelete(this.graphic());
  }
}
