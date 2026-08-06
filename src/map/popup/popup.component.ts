import { Component, computed, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { PopupStore } from './popup.store';
import { PopupContentComponent, type PopupTab } from './content/popup-content.component';
import { DeleteService } from '../delete/delete.service';
import { DeleteStore } from '../delete/delete.store';
import Graphic from '@arcgis/core/Graphic';
import '@esri/calcite-components/dist/components/calcite-icon';
import '@esri/calcite-components/dist/components/calcite-action';
import '@esri/calcite-components/dist/components/calcite-action-bar';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'rima-popup',
  imports: [PopupContentComponent, ConfirmDialogComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './popup.component.html',
  styleUrl: './popup.component.scss',
})
export class PopupComponent {
  protected readonly store = inject(PopupStore);
  protected readonly deleteStore = inject(DeleteStore);
  protected readonly activeTab = signal<PopupTab>('attributes');
  private readonly deleteService = inject(DeleteService);

  private static readonly TAB_LABELS: Record<PopupTab, string> = {
    attributes: 'Attributes',
    reference: 'Reference Points',
    status: 'Zustand',
    hierarchy: 'Hierarchy',
    documents: 'Documents',
  };

  protected readonly activeTabLabel = computed(() => PopupComponent.TAB_LABELS[this.activeTab()]);

  protected async onDeleteConfirm(confirmed: boolean): Promise<void> {
    if (confirmed) {
      await this.deleteService.confirmDelete();
    } else {
      this.deleteService.cancelDelete();
    }
  }

  onEscape(): void {
    this.requestClose();
  }

  requestClose(): void {
    this.store.close();
  }

  selectTab(tab: PopupTab): void {
    this.activeTab.set(tab);
  }

  getFeatureLabel(graphic: Graphic): string {
    const attrs = graphic.attributes;
    if (!attrs) return 'Feature';
    return attrs.OBJECTID ?? attrs.FID ?? attrs.ID ?? Object.values(attrs)[0] ?? 'Feature';
  }
}
