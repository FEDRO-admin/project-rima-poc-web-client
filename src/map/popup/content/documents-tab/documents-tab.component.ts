import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject, input, signal } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import '@esri/calcite-components/dist/components/calcite-loader';
import '@esri/calcite-components/dist/components/calcite-button';
import '@esri/calcite-components/dist/components/calcite-icon';
import { DocumentsStore } from '../../../documents/documents.store';
import { DocumentsService } from '../../../documents/documents.service';
import { DocumentRecord, DocumentUploadPayload } from '../../../documents/document-types';
import { DOCUMENTS_MAX_FILE_SIZE_MB } from '../../../documents/documents-config';
import { HistoryStore } from '../../../history/history.store';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'rima-documents-tab',
  imports: [ConfirmDialogComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './documents-tab.component.html',
  styleUrl: './documents-tab.component.scss',
})
export class DocumentsTabComponent {
  readonly graphic = input.required<Graphic>();

  protected readonly documentsStore = inject(DocumentsStore);
  protected readonly historyStore = inject(HistoryStore);
  private readonly documentsService = inject(DocumentsService);

  protected readonly showUploadForm = signal(false);
  protected readonly documentToDelete = signal<DocumentRecord | undefined>(undefined);

  protected readonly uploadTitel = signal('');
  protected readonly uploadBeschreibung = signal('');
  protected readonly uploadTyp = signal('');
  protected readonly uploadVersion = signal('');
  protected readonly uploadStatus = signal('');
  protected readonly selectedFile = signal<File | undefined>(undefined);
  protected readonly maxFileSizeMB = DOCUMENTS_MAX_FILE_SIZE_MB;

  constructor() {
    effect(() => {
      const graphic = this.graphic();
      if (graphic) {
        this.documentsStore.setGraphic(graphic);
      }
    });
  }

  protected openDocument(record: DocumentRecord): void {
    const url = this.documentsService.getDownloadUrl(record);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected downloadDocument(record: DocumentRecord): void {
    const url = this.documentsService.getDownloadUrl(record);
    const link = document.createElement('a');
    link.href = url;
    link.download = record.name || record.titel;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  protected isViewable(record: DocumentRecord): boolean {
    return this.documentsService.isViewable(record);
  }

  protected formatFileSize(bytes: number): string {
    return this.documentsService.formatFileSize(bytes);
  }

  protected requestDelete(record: DocumentRecord): void {
    this.documentToDelete.set(record);
  }

  protected async handleDeleteConfirmation(confirmed: boolean): Promise<void> {
    const record = this.documentToDelete();
    this.documentToDelete.set(undefined);

    if (!confirmed || !record) return;

    try {
      await this.documentsService.deleteDocument(record, this.graphic());
    } catch {
      // Error handled by service via store
    }
  }

  protected openUploadForm(): void {
    this.showUploadForm.set(true);
    this.resetUploadForm();
  }

  protected cancelUpload(): void {
    this.showUploadForm.set(false);
    this.resetUploadForm();
  }

  protected onFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    this.selectedFile.set(file);
  }

  protected async submitUpload(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    const payload: DocumentUploadPayload = {
      file,
      titel: this.uploadTitel(),
      beschreibung: this.uploadBeschreibung(),
      typ: this.uploadTyp(),
      version: this.uploadVersion(),
      status: this.uploadStatus(),
    };

    try {
      await this.documentsService.uploadDocument(this.graphic(), payload);
      this.showUploadForm.set(false);
      this.resetUploadForm();
    } catch {
      // Error handled by service via store
    }
  }

  private resetUploadForm(): void {
    this.uploadTitel.set('');
    this.uploadBeschreibung.set('');
    this.uploadTyp.set('');
    this.uploadVersion.set('');
    this.uploadStatus.set('');
    this.selectedFile.set(undefined);
  }
}
