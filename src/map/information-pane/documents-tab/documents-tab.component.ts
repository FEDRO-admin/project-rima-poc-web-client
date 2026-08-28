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
import type Graphic from '@arcgis/core/Graphic';
import type Point from '@arcgis/core/geometry/Point';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import '@esri/calcite-components/dist/components/calcite-loader';
import '@esri/calcite-components/dist/components/calcite-button';
import '@esri/calcite-components/dist/components/calcite-icon';
import { DocumentsStore } from './documents.store';
import { DocumentsService } from './documents.service';
import { DocumentUploadService } from './document-upload.service';
import { DocumentAccessLevel, DocumentRecord, DocumentUploadPayload, DocumentEditPayload } from './document-types';
import { DOCUMENTS_MAX_FILE_SIZE_MB, DOCUMENTS_MAP_LAYER_TITLE } from './documents-config';
import {
  DocumentEditError,
  DocumentFileTooLargeError,
  DocumentRelationshipNotFoundError,
  DocumentUnsupportedFileTypeError,
  DocumentUploadError,
} from './documents-errors';
import { PointPlacementStore, PointPlacementService, POINT_PLACEMENT_CONFIG } from '../../shared/point-placement';
import { DOCUMENT_POINT_PLACING_SYMBOL } from './document-geometry-config';
import { activateLayer, deactivateLayer, LayerActivationState } from '../../shared/layer-activation-utils';
import { highlightFeatures } from '../../shared/layer-highlight-utils';
import { ViewService } from '../../view/view.service';
import { ViewStore } from '../../view/view.store';
import { DialogActionsComponent } from '../../../shared/dialog-actions/dialog-actions.component';
import { DialogActionComponent } from '../../../shared/dialog-actions/dialog-action.component';
import { ActionBarComponent } from '../../../shared/action-bar/action-bar.component';
import { ActionBarButtonComponent } from '../../../shared/action-bar/action-bar-button.component';
import { AttributeFormComponent } from '../../shared/attribute-form/attribute-form.component';
import { AttributeValue } from '../../shared/attribute-value-conversion';
import { DatePipe, DecimalPipe } from '@angular/common';

type DocumentsConfirmAction = 'upload' | 'save' | 'cancel-upload' | 'cancel-edit' | 'delete';

@Component({
  selector: 'rima-documents-tab',
  imports: [
    DialogActionsComponent,
    DialogActionComponent,
    DatePipe,
    DecimalPipe,
    ActionBarComponent,
    ActionBarButtonComponent,
    AttributeFormComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [
    PointPlacementStore,
    PointPlacementService,
    { provide: POINT_PLACEMENT_CONFIG, useValue: { placingSymbol: DOCUMENT_POINT_PLACING_SYMBOL } },
  ],
  templateUrl: './documents-tab.component.html',
  styleUrl: './documents-tab.component.scss',
})
export class DocumentsTabComponent implements OnDestroy {
  readonly graphic = input.required<Graphic>();

  protected readonly documentsStore = inject(DocumentsStore);
  protected readonly viewStore = inject(ViewStore);
  protected readonly documentsService = inject(DocumentsService);
  protected readonly geometryStore = inject(PointPlacementStore);
  protected readonly geometryService = inject(PointPlacementService);
  private readonly viewService = inject(ViewService);
  private readonly uploadService = inject(DocumentUploadService);

  private layerActivationState: LayerActivationState | undefined;
  private highlightHandle: { remove(): void } | undefined;

  protected readonly uploadProgress = this.uploadService.progress;

  protected readonly showUploadForm = signal(false);
  protected readonly documentToDelete = signal<DocumentRecord | undefined>(undefined);
  protected readonly expandedDocId = signal<number | undefined>(undefined);

  protected readonly uploadFile = signal<File | undefined>(undefined);
  protected readonly uploadAccess = signal<DocumentAccessLevel>('org');
  protected readonly uploadAttributes = signal<Record<string, AttributeValue>>({});
  protected readonly uploadError = signal<string | undefined>(undefined);
  protected readonly maxFileSizeMB = DOCUMENTS_MAX_FILE_SIZE_MB;

  protected readonly editingDocument = signal<DocumentRecord | undefined>(undefined);
  protected readonly editFile = signal<File | undefined>(undefined);
  protected readonly editAccess = signal<DocumentAccessLevel>('org');
  protected readonly editAttributes = signal<Record<string, AttributeValue>>({});
  protected readonly editError = signal<string | undefined>(undefined);

  protected readonly uploadGeometry = signal<Point | undefined>(undefined);
  protected readonly editGeometry = signal<Point | undefined>(undefined);
  protected readonly editGeometryRemoved = signal(false);

  protected readonly confirmAction = signal<DocumentsConfirmAction | undefined>(undefined);
  protected readonly confirmMessage = computed(() => {
    switch (this.confirmAction()) {
      case 'upload':
        return 'Dokument hochladen?';
      case 'save':
        return 'Änderungen speichern?';
      case 'cancel-upload':
      case 'cancel-edit':
        return 'Änderungen verwerfen?';
      case 'delete':
        return `Möchten Sie das Dokument "${this.getDocTitle(this.documentToDelete())}" wirklich löschen?`;
      case undefined:
        return undefined;
    }
  });
  protected readonly formActive = computed(() => this.showUploadForm() || !!this.editingDocument());

  constructor() {
    effect(() => {
      const graphic = this.graphic();
      if (graphic) {
        this.documentsStore.setGraphic(graphic);
      }
    });

    this.activateAndHighlightOnLoad();
  }

  ngOnDestroy(): void {
    this.highlightHandle?.remove();
    this.deactivateDocumentLayer();
  }

  private activateAndHighlightOnLoad(): void {
    effect(() => {
      const loadState = this.documentsStore.loadState();
      untracked(() => {
        if (loadState === 'loaded') {
          this.activateDocumentLayer();
          this.rehighlight();
        }
      });
    });
  }

  private activateDocumentLayer(): void {
    if (this.layerActivationState) return;
    const view = this.viewService.activeView();
    if (!view?.map) return;
    this.layerActivationState = activateLayer(view.map, DOCUMENTS_MAP_LAYER_TITLE);
  }

  private deactivateDocumentLayer(): void {
    const view = this.viewService.activeView();
    if (!view?.map || !this.layerActivationState) return;
    deactivateLayer(view.map, this.layerActivationState);
    this.layerActivationState = undefined;
  }

  private async rehighlight(): Promise<void> {
    this.highlightHandle?.remove();
    this.highlightHandle = undefined;

    const objectIds = this.documentsStore
      .documents()
      .filter((d) => !!d.geometry)
      .map((d) => d.objectId);

    const view = this.viewService.activeView();
    if (!view?.map || !objectIds.length) return;

    const layer = view.map.allLayers.find((l) => l.title === DOCUMENTS_MAP_LAYER_TITLE);
    if (!layer) return;

    this.highlightHandle = await highlightFeatures(view, layer as FeatureLayer, objectIds);
  }

  protected getDocTitle(record: DocumentRecord | undefined): string {
    if (!record) return '';
    return (record.attributes['titel'] as string) || (record.attributes['name'] as string) || '';
  }

  protected openDocument(record: DocumentRecord): void {
    const url = this.documentsService.getDownloadUrl(record);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected async downloadDocument(record: DocumentRecord): Promise<void> {
    await this.documentsService.downloadDocument(record);
  }

  protected isViewable(record: DocumentRecord): boolean {
    return this.documentsService.isViewable(record);
  }

  protected formatFileSize(bytes: number): string {
    return this.documentsService.formatFileSize(bytes);
  }

  protected requestDelete(record: DocumentRecord): void {
    this.documentToDelete.set(record);
    this.confirmAction.set('delete');
  }

  protected toggleDetails(objectId: number): void {
    this.expandedDocId.set(this.expandedDocId() === objectId ? undefined : objectId);
  }

  protected requestUpload(): void {
    this.confirmAction.set('upload');
  }

  protected requestSave(): void {
    this.confirmAction.set('save');
  }

  protected requestCancelUpload(): void {
    this.confirmAction.set('cancel-upload');
  }

  protected requestCancelEdit(): void {
    this.confirmAction.set('cancel-edit');
  }

  protected dismissConfirm(): void {
    if (this.confirmAction() === 'delete') {
      this.documentToDelete.set(undefined);
    }
    this.confirmAction.set(undefined);
  }

  protected onConfirmPrimary(): void {
    const action = this.confirmAction();
    this.confirmAction.set(undefined);
    switch (action) {
      case 'upload':
        this.submitUpload();
        break;
      case 'save':
        this.submitEdit();
        break;
      case 'cancel-upload':
        this.performCancelUpload();
        break;
      case 'cancel-edit':
        this.performCancelEdit();
        break;
      case 'delete':
        this.performDelete();
        break;
      case undefined:
        break;
    }
  }

  private async performDelete(): Promise<void> {
    const record = this.documentToDelete();
    this.documentToDelete.set(undefined);
    if (!record) return;
    try {
      await this.documentsService.deleteDocument(record, this.graphic());
    } catch {
      // Error handled by service via store
    }
  }

  private performCancelUpload(): void {
    this.showUploadForm.set(false);
    this.resetUploadForm();
    this.geometryService.cancelPlacing();
  }

  private performCancelEdit(): void {
    this.editingDocument.set(undefined);
    this.editError.set(undefined);
    this.editGeometry.set(undefined);
    this.editGeometryRemoved.set(false);
    this.geometryService.cancelPlacing();
  }

  protected openUploadForm(): void {
    this.showUploadForm.set(true);
    this.resetUploadForm();
    this.geometryService.cancelPlacing();
  }

  protected cancelUpload(): void {
    this.requestCancelUpload();
  }

  protected onFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    this.uploadFile.set(file);
    if (file && !this.uploadAttributes()['titel']) {
      const titel = file.name.includes('.') ? file.name.substring(0, file.name.lastIndexOf('.')) : file.name;
      this.uploadAttributes.update((a) => ({ ...a, titel }));
    }
  }

  protected onUploadFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.uploadAttributes.update((a) => ({ ...a, [event.fieldName]: event.value }));
  }

  private async submitUpload(): Promise<void> {
    const file = this.uploadFile();
    if (!file) return;

    this.uploadError.set(undefined);

    const payload: DocumentUploadPayload = {
      file,
      sharing: { access: this.uploadAccess() },
      editableAttributes: this.uploadAttributes(),
      geometry: this.geometryStore.placedGeometry(),
    };

    try {
      await this.documentsService.uploadDocument(this.graphic(), payload);
      this.showUploadForm.set(false);
      this.resetUploadForm();
      this.rehighlight();
    } catch (error) {
      if (error instanceof DocumentFileTooLargeError) {
        this.uploadError.set(`Die Datei ist zu gross (max. ${this.maxFileSizeMB} MB).`);
      } else if (error instanceof DocumentUnsupportedFileTypeError) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
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
    this.uploadFile.set(undefined);
    this.uploadAccess.set('org');
    this.uploadAttributes.set({});
    this.uploadError.set(undefined);
    this.uploadGeometry.set(undefined);
    this.geometryStore.setPlacedGeometry(undefined);
  }

  protected openEditForm(record: DocumentRecord): void {
    this.editingDocument.set(record);
    this.editAttributes.set({ ...record.attributes });
    this.editFile.set(undefined);
    this.editAccess.set('org');
    this.editError.set(undefined);
    this.editGeometry.set(record.geometry);
    this.editGeometryRemoved.set(false);
    this.geometryStore.setPlacedGeometry(undefined);
  }

  protected cancelEdit(): void {
    this.requestCancelEdit();
  }

  protected onEditFileSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    this.editFile.set(file);
  }

  protected onEditFieldChange(event: { fieldName: string; value: AttributeValue }): void {
    this.editAttributes.update((a) => ({ ...a, [event.fieldName]: event.value }));
  }

  private async submitEdit(): Promise<void> {
    const record = this.editingDocument();
    if (!record) return;

    this.editError.set(undefined);

    const resolvedGeometry = this.resolveEditGeometry(record);
    const payload: DocumentEditPayload = {
      editableAttributes: this.editAttributes(),
      file: this.editFile(),
      sharing: this.editFile() ? { access: this.editAccess() } : undefined,
      geometry: resolvedGeometry,
    };

    try {
      await this.documentsService.editDocument(record, payload);
      this.editingDocument.set(undefined);
      this.editGeometry.set(undefined);
      this.editGeometryRemoved.set(false);
      this.geometryStore.setPlacedGeometry(undefined);
      this.rehighlight();
    } catch (error) {
      if (error instanceof DocumentFileTooLargeError) {
        this.editError.set(`Die Datei ist zu gross (max. ${this.maxFileSizeMB} MB).`);
      } else if (error instanceof DocumentUnsupportedFileTypeError) {
        const ext = this.editFile()?.name.split('.').pop()?.toLowerCase() ?? '';
        this.editError.set(`Dateityp .${ext} wird nicht unterstützt.`);
      } else if (error instanceof DocumentEditError) {
        this.editError.set('Fehler beim Speichern der Änderungen.');
      } else {
        this.editError.set('Fehler beim Bearbeiten des Dokuments.');
      }
    }
  }

  private resolveEditGeometry(record: DocumentRecord): Point | undefined {
    const placed = this.geometryStore.placedGeometry();
    if (placed) return placed;
    if (this.editGeometryRemoved()) return undefined;
    return record.geometry;
  }

  protected startUploadPlacing(): void {
    this.geometryService.startPlacing();
  }

  protected startEditPlacing(): void {
    this.geometryService.startPlacing();
  }

  protected adjustUploadGeometry(): void {
    const geometry = this.geometryStore.placedGeometry();
    if (geometry) {
      this.geometryService.startAdjusting(geometry);
    }
  }

  protected adjustEditGeometry(): void {
    const geometry = this.geometryStore.placedGeometry() ?? this.editGeometry();
    if (geometry) {
      this.geometryService.startAdjusting(geometry);
    }
  }

  protected removeUploadGeometry(): void {
    this.geometryService.cancelPlacing();
  }

  protected removeEditGeometry(): void {
    this.geometryService.cancelPlacing();
    this.editGeometry.set(undefined);
    this.editGeometryRemoved.set(true);
  }

  protected get effectiveEditGeometry(): Point | undefined {
    return this.geometryStore.placedGeometry() ?? (this.editGeometryRemoved() ? undefined : this.editGeometry());
  }
}
