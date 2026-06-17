import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { PopupStore } from './popup.store';
import { PopupContentComponent } from './content/popup-content.component';
import { MapViewService } from '../view/view.service';
import { EditStore } from '../edit/edit.store';
import { EditService } from '../edit/edit.service';
import { ConfirmDialogComponent } from '../edit/confirm-dialog/confirm-dialog.component';
import Graphic from '@arcgis/core/Graphic';
import '@esri/calcite-components/dist/components/calcite-icon';

@Component({
  selector: 'rima-popup',
  imports: [PopupContentComponent, ConfirmDialogComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './popup.component.html',
  styleUrl: './popup.component.scss',
})
export class PopupComponent {
  protected readonly store = inject(PopupStore);
  protected readonly editStore = inject(EditStore);
  private readonly editService = inject(EditService);
  private readonly viewService = inject(MapViewService);

  protected readonly showCloseConfirm = signal(false);

  onEscape(): void {
    this.requestClose();
  }

  requestClose(): void {
    if (this.editStore.editing() && this.editStore.isDirty()) {
      this.showCloseConfirm.set(true);
    } else {
      this.close();
    }
  }

  onCloseConfirm(confirmed: boolean): void {
    this.showCloseConfirm.set(false);
    if (confirmed) {
      this.close();
    }
  }

  private close(): void {
    if (this.editStore.editing()) {
      this.editService.cancel();
    }
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
