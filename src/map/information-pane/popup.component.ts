import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { PopupStore } from './popup.store';
import { PopupContentComponent, type PopupTab } from './popup-content.component';
import { AttributeDeleteService } from './attributes-tab/attribute-delete.service';
import { AttributeDeleteStore } from './attributes-tab/attribute-delete.store';
import { AttributeEditStore } from './attributes-tab/attribute-edit.store';
import { AttributeEditService } from './attributes-tab/attribute-edit.service';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-icon';
import '@esri/calcite-components/dist/components/calcite-action';
import '@esri/calcite-components/dist/components/calcite-action-bar';
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions.component';
import { DialogActionComponent } from '../../shared/dialog-actions/dialog-action.component';
import { AttributesTabComponent } from './attributes-tab/attributes-tab.component';
import { buildFeatureDisplayLabel, buildFeatureListLabel } from '../shared/display-label';

@Component({
  selector: 'rima-popup',
  imports: [PopupContentComponent, DialogActionsComponent, DialogActionComponent, AttributesTabComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './popup.component.html',
  styleUrl: './popup.component.scss',
})
export class PopupComponent {
  protected readonly store = inject(PopupStore);
  protected readonly deleteStore = inject(AttributeDeleteStore);
  protected readonly editStore = inject(AttributeEditStore);
  protected readonly activeTab = signal<PopupTab>('attributes');
  private readonly deleteService = inject(AttributeDeleteService);
  private readonly editService = inject(AttributeEditService);

  private static readonly TAB_LABELS: Record<PopupTab, string> = {
    attributes: 'Attributes',
    reference: 'Reference Points',
    status: 'Zustand',
    hierarchy: 'Hierarchy',
    documents: 'Documents',
  };

  protected readonly activeGraphicTitle = computed(() => {
    const graphic = this.store.selectedGraphic();
    if (!graphic) return this.activeTabLabel();
    return buildFeatureDisplayLabel(graphic);
  });

  protected readonly activeGraphicSubtitle = computed(() => this.store.selectedGraphic()?.layer?.title ?? '');

  protected readonly activeTabLabel = computed(() => PopupComponent.TAB_LABELS[this.activeTab()]);

  protected readonly actionBarExpanded = signal(false);

  protected readonly isFeatureLayerSelected = computed(() => {
    const graphic = this.store.selectedGraphic();
    return graphic?.layer instanceof FeatureLayer;
  });

  protected async confirmDelete(): Promise<void> {
    await this.deleteService.confirmDelete();
  }

  protected cancelDelete(): void {
    this.deleteService.cancelDelete();
  }

  protected cancelCreate(): void {
    this.editService.cancel();
  }

  onEscape(): void {
    this.requestClose();
  }

  requestClose(): void {
    if (this.editStore.active()) {
      this.editService.cancel();
      return;
    }
    this.store.close();
  }

  selectTab(tab: PopupTab): void {
    this.activeTab.set(tab);
  }

  onActionBarToggle(event: Event): void {
    const bar = event.target as HTMLElement & { expanded: boolean };
    this.actionBarExpanded.set(bar.expanded);
  }

  getFeatureLabel(graphic: Graphic): string {
    return buildFeatureListLabel(graphic);
  }
}
