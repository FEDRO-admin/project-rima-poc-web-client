import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { PopupStore } from './popup.store';
import { PopupContentComponent } from './content/popup-content.component';
import { MapViewService } from '../view/view.service';
import { EditService } from '../edit/edit.service';
import { DeleteService } from '../delete/delete.service';
import { DeleteStore } from '../delete/delete.store';
import Graphic from '@arcgis/core/Graphic';
import '@esri/calcite-components/dist/components/calcite-icon';
import { isLayerEditable } from '../layer/layer-capabilities';
import { isLayerDeletable } from '../layer/layer-capabilities';
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
  private readonly editService = inject(EditService);
  private readonly deleteService = inject(DeleteService);
  private readonly viewService = inject(MapViewService);

  protected isEditable(): boolean {
    const graphic = this.store.selectedGraphic();
    return graphic ? isLayerEditable(graphic) : false;
  }

  protected isDeletable(): boolean {
    const graphic = this.store.selectedGraphic();
    return graphic ? isLayerDeletable(graphic) : false;
  }

  protected startEdit(): void {
    const graphic = this.store.selectedGraphic();
    if (graphic) {
      this.editService.activate(graphic);
    }
  }

  protected startDelete(): void {
    const graphic = this.store.selectedGraphic();
    if (graphic) {
      this.deleteService.requestDelete(graphic);
    }
  }

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

  zoomTo(): void {
    const graphic = this.store.selectedGraphic();
    const view = this.viewService.mapView();
    if (!graphic?.geometry || !view) return;
    view.goTo({ target: graphic.geometry, zoom: 15 });
  }

  getFeatureLabel(graphic: Graphic): string {
    const attrs = graphic.attributes;
    if (!attrs) return 'Feature';
    return attrs.OBJECTID ?? attrs.FID ?? attrs.ID ?? Object.values(attrs)[0] ?? 'Feature';
  }
}
