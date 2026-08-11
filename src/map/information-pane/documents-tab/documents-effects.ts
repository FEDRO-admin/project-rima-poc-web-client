import { effect, inject, Injectable, untracked } from '@angular/core';
import { DocumentsStore } from './documents.store';
import { DocumentsService } from './documents.service';
import { PopupStore } from '../popup.store';

@Injectable({
  providedIn: 'root',
})
export class DocumentsEffects {
  private readonly documentsStore = inject(DocumentsStore);
  private readonly documentsService = inject(DocumentsService);
  private readonly popupStore = inject(PopupStore);

  constructor() {
    this.loadDocumentsOnGraphicChange();
    this.resetOnPopupClose();
  }

  private loadDocumentsOnGraphicChange(): void {
    effect(() => {
      const graphic = this.documentsStore.graphic();
      untracked(async () => {
        if (!graphic) return;

        try {
          await this.documentsService.loadDocuments(graphic);
        } catch {
          // Error is already handled in the service via store.setError()
        }
      });
    });
  }

  private resetOnPopupClose(): void {
    effect(() => {
      const visible = this.popupStore.visible();
      untracked(() => {
        if (!visible) {
          this.documentsStore.reset();
        }
      });
    });
  }
}
