import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, inject, input, signal } from '@angular/core';
import type Graphic from '@arcgis/core/Graphic';
import '@esri/calcite-components/dist/components/calcite-loader';
import '@esri/calcite-components/dist/components/calcite-button';
import '@esri/calcite-components/dist/components/calcite-icon';
import { DocumentsStore } from '../../../documents/documents.store';
import { DocumentsService } from '../../../documents/documents.service';
import { DocumentUploadService } from '../../../documents/document-upload.service';
import { DocumentAccessLevel, DocumentRecord, DocumentUploadPayload } from '../../../documents/document-types';
import { DOCUMENTS_MAX_FILE_SIZE_MB } from '../../../documents/documents-config';
import {
  DocumentFileTooLargeError,
  DocumentRelationshipNotFoundError,
  DocumentUnsupportedFileTypeError,
  DocumentUploadError,
} from '../../../documents/documents-errors';
import { HistoryStore } from '../../../history/history.store';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { DatePipe } from '@angular/common';

interface UploadFormModel {
  titel: string;
  beschreibung: string;
  typ: string;
  version: string;
  status: string;
  file?: File;
  access: DocumentAccessLevel;
}

const INITIAL_UPLOAD_FORM: UploadFormModel = {
  titel: '',
  beschreibung: '',
  typ: '',
  version: '',
  status: '',
  file: undefined,
  access: 'private',
};

@Component({
  selector: 'rima-documents-tab',
  imports: [ConfirmDialogComponent, DatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './documents-tab.component.html',
  styleUrl: './documents-tab.component.scss',
})
export class DocumentsTabComponent {
  readonly graphic = input.required<Graphic>();

  protected readonly documentsStore = inject(DocumentsStore);
  protected readonly historyStore = inject(HistoryStore);
  private readonly documentsService = inject(DocumentsService);
  private readonly uploadService = inject(DocumentUploadService);

  protected readonly uploadProgress = this.uploadService.progress;

  protected readonly showUploadForm = signal(false);
  protected readonly documentToDelete = signal<DocumentRecord | undefined>(undefined);
  protected readonly expandedDocId = signal<number | undefined>(undefined);

  protected readonly uploadForm = signal<UploadFormModel>(INITIAL_UPLOAD_FORM);
  protected readonly uploadError = signal<string | undefined>(undefined);
  protected readonly maxFileSizeMB = DOCUMENTS_MAX_FILE_SIZE_MB;
  protected readonly typDomain = signal<string[]>([]);
  protected readonly statusDomain = signal<string[]>([]);

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

  protected toggleDetails(objectId: number): void {
    this.expandedDocId.set(this.expandedDocId() === objectId ? undefined : objectId);
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
    this.loadDomainValues();
  }

  protected cancelUpload(): void {
    this.showUploadForm.set(false);
    this.resetUploadForm();
  }

  protected onFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    this.uploadForm.update((f) => ({
      ...f,
      file,
      titel:
        file && !f.titel
          ? file.name.includes('.')
            ? file.name.substring(0, file.name.lastIndexOf('.'))
            : file.name
          : f.titel,
    }));
  }

  protected async submitUpload(): Promise<void> {
    const form = this.uploadForm();
    if (!form.file) return;

    this.uploadError.set(undefined);

    const payload: DocumentUploadPayload = {
      file: form.file,
      titel: form.titel,
      beschreibung: form.beschreibung,
      typ: form.typ,
      version: form.version,
      status: form.status,
      sharing: {
        access: form.access,
      },
    };

    try {
      await this.documentsService.uploadDocument(this.graphic(), payload);
      this.showUploadForm.set(false);
      this.resetUploadForm();
    } catch (error) {
      if (error instanceof DocumentFileTooLargeError) {
        this.uploadError.set(`Die Datei ist zu gross (max. ${this.maxFileSizeMB} MB).`);
      } else if (error instanceof DocumentUnsupportedFileTypeError) {
        const ext = form.file.name.split('.').pop()?.toLowerCase() ?? '';
        this.uploadError.set(`Dateityp .${ext} wird nicht unterstützt.`);
      } else if (error instanceof DocumentRelationshipNotFoundError) {
        this.uploadError.set('Dokumentverknüpfung nicht gefunden. Upload nicht möglich.');
      } else {
        const detail = error instanceof DocumentUploadError && error.detail ? error.detail : '';
        console.error('[Documents] Upload failed:', error);
        this.uploadError.set(detail ? `Fehler beim Hochladen: ${detail}` : 'Fehler beim Hochladen des Dokuments.');
      }
    }
  }

  private resetUploadForm(): void {
    this.uploadForm.set(INITIAL_UPLOAD_FORM);
    this.uploadError.set(undefined);
  }

  protected updateForm<K extends keyof UploadFormModel>(field: K, value: UploadFormModel[K]): void {
    this.uploadForm.update((f) => ({ ...f, [field]: value }));
  }

  private async loadDomainValues(): Promise<void> {
    try {
      const [typValues, statusValues] = await Promise.all([
        this.documentsService.getFieldDomainValues('typ'),
        this.documentsService.getFieldDomainValues('status'),
      ]);
      this.typDomain.set(typValues);
      this.statusDomain.set(statusValues);
    } catch {
      this.typDomain.set([]);
      this.statusDomain.set([]);
    }
  }
}
