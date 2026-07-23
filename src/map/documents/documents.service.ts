import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Layer from '@arcgis/core/layers/Layer';
import Graphic from '@arcgis/core/Graphic';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type Relationship from '@arcgis/core/layers/support/Relationship';
import { ViewService } from '../view/view.service';
import { HistoryStore } from '../history/history.store';
import { PortalService } from '../portal/portal.service';
import { DocumentsStore } from './documents.store';
import { DocumentUploadService } from './document-upload.service';
import {
  DocumentEditPayload,
  DocumentRecord,
  DocumentUploadPayload,
  mapDocumentRecordToAttributes,
  mapGraphicToDocumentRecord,
} from './document-types';
import { DOCUMENTS_LAYER_ID, DOCUMENTS_MAX_FILE_SIZE_MB, DOCUMENTS_VIEWABLE_TYPES } from './documents-config';
import {
  DocumentDeleteError,
  DocumentEditError,
  DocumentFileTooLargeError,
  DocumentQueryError,
  DocumentRelationshipNotFoundError,
  DocumentUploadError,
} from './documents-errors';

@Injectable({
  providedIn: 'root',
})
export class DocumentsService {
  private readonly viewService = inject(ViewService);
  private readonly historyStore = inject(HistoryStore);
  private readonly portalService = inject(PortalService);
  private readonly documentsStore = inject(DocumentsStore);
  private readonly uploadService = inject(DocumentUploadService);

  async loadDocuments(graphic: Graphic): Promise<void> {
    const layer = graphic.layer as FeatureLayer;
    if (!layer?.relationships?.length) {
      this.documentsStore.setDocuments([]);
      return;
    }

    const relationship = this.findDocumentRelationship(layer);
    if (!relationship) {
      this.documentsStore.setDocuments([]);
      return;
    }

    this.documentsStore.setLoading();

    try {
      const objectId = graphic.attributes[layer.objectIdField];
      const query = new RelationshipQuery({
        objectIds: [objectId],
        relationshipId: relationship.id,
        outFields: ['*'],
        returnGeometry: false,
        historicMoment: this.historyStore.selectedDate() ?? undefined,
      });

      const result = await layer.queryRelatedFeatures(query);
      const featureSet = result[objectId];

      if (!featureSet?.features?.length) {
        this.documentsStore.setDocuments([]);
        return;
      }

      const documentLayer = this.findDocumentLayer();
      const objectIdField = documentLayer?.objectIdField ?? 'objectid';

      const documents: DocumentRecord[] = featureSet.features.map((f: Graphic) =>
        mapGraphicToDocumentRecord(f, objectIdField),
      );

      this.documentsStore.setDocuments(documents);
    } catch (error) {
      this.documentsStore.setError('documents.error.query');
      throw new DocumentQueryError(error);
    }
  }

  async uploadDocument(graphic: Graphic, payload: DocumentUploadPayload): Promise<void> {
    const fileSizeMB = payload.file.size / (1024 * 1024);
    if (fileSizeMB > DOCUMENTS_MAX_FILE_SIZE_MB) {
      throw new DocumentFileTooLargeError();
    }

    const layer = graphic.layer as FeatureLayer;
    const relationship = this.findDocumentRelationship(layer);
    if (!relationship) {
      throw new DocumentRelationshipNotFoundError();
    }

    const documentLayer = this.findDocumentLayer();
    if (!documentLayer) {
      throw new DocumentRelationshipNotFoundError();
    }

    try {
      const downloadUrl = await this.uploadService.uploadFile(payload.file, payload.titel, payload.sharing);

      const portal = await this.portalService.getPortal();
      const user = portal.user!;
      const parentKeyValue = this.getParentKeyValue(graphic, relationship);
      const geometry = undefined; // for now, clarify in thursday meeting if geom is needed.

      const documentRecord: DocumentRecord = {
        objectId: 0,
        id: crypto.randomUUID(),
        name: payload.file.name,
        fkParent: parentKeyValue,
        parentClassName: layer.title ?? '',
        titel: payload.titel,
        beschreibung: payload.beschreibung,
        autor: user.fullName ?? user.username ?? '',
        typ: payload.typ,
        pfad: downloadUrl,
        status: payload.status,
        letzteAenderung: new Date(),
        version: payload.version,
        groesse: payload.file.size,
        anzahlSeiten: null,
      };

      const attributes = mapDocumentRecordToAttributes(documentRecord, documentLayer.objectIdField);
      const newGraphic = new Graphic({ attributes, geometry });
      const editResult = await documentLayer.applyEdits({ addFeatures: [newGraphic] });

      if (editResult.addFeatureResults[0]?.error) {
        throw new DocumentUploadError(editResult.addFeatureResults[0].error);
      }

      const newObjectId = editResult.addFeatureResults[0]?.objectId ?? 0;
      this.documentsStore.addDocument({ ...documentRecord, objectId: newObjectId });
    } catch (error) {
      if (error instanceof DocumentFileTooLargeError || error instanceof DocumentRelationshipNotFoundError) {
        throw error;
      }
      console.error('[Documents] Root cause:', error);
      throw new DocumentUploadError(error);
    } finally {
      this.uploadService.resetProgress();
    }
  }

  async deleteDocument(record: DocumentRecord, graphic: Graphic): Promise<void> {
    const layer = graphic.layer as FeatureLayer;
    const relationship = this.findDocumentRelationship(layer);
    if (!relationship) {
      throw new DocumentRelationshipNotFoundError();
    }

    const documentLayer = this.findDocumentLayer();
    if (!documentLayer) {
      throw new DocumentRelationshipNotFoundError();
    }

    this.documentsStore.setDeleting(true);

    try {
      await this.uploadService.deleteFile(record.pfad);

      const deleteGraphic = new Graphic({
        attributes: { [documentLayer.objectIdField]: record.objectId },
      });

      const editResult = await documentLayer.applyEdits({ deleteFeatures: [deleteGraphic] });

      if (editResult.deleteFeatureResults[0]?.error) {
        throw new DocumentDeleteError(editResult.deleteFeatureResults[0].error);
      }

      this.documentsStore.removeDocument(record.objectId);
    } catch (error) {
      if (error instanceof DocumentRelationshipNotFoundError) {
        throw error;
      }
      throw new DocumentDeleteError(error);
    } finally {
      this.documentsStore.setDeleting(false);
    }
  }

  async editDocument(record: DocumentRecord, payload: DocumentEditPayload): Promise<void> {
    if (payload.file) {
      const fileSizeMB = payload.file.size / (1024 * 1024);
      if (fileSizeMB > DOCUMENTS_MAX_FILE_SIZE_MB) {
        throw new DocumentFileTooLargeError();
      }
    }

    const documentLayer = this.findDocumentLayer();
    if (!documentLayer) {
      throw new DocumentRelationshipNotFoundError();
    }

    try {
      let newPfad = record.pfad;
      let newGroesse = record.groesse;
      let newName = record.name;

      if (payload.file && payload.sharing) {
        newPfad = await this.uploadService.replaceFile(record.pfad, payload.file, payload.titel, payload.sharing);
        newGroesse = payload.file.size;
        newName = payload.file.name;
      }

      const updatedRecord: DocumentRecord = {
        ...record,
        titel: payload.titel,
        beschreibung: payload.beschreibung,
        typ: payload.typ,
        status: payload.status,
        version: payload.version,
        pfad: newPfad,
        groesse: newGroesse,
        name: newName,
        letzteAenderung: new Date(),
      };

      const attributes = mapDocumentRecordToAttributes(updatedRecord, documentLayer.objectIdField);
      const updateGraphic = new Graphic({ attributes });
      const editResult = await documentLayer.applyEdits({ updateFeatures: [updateGraphic] });

      if (editResult.updateFeatureResults[0]?.error) {
        throw new DocumentEditError();
      }

      this.documentsStore.updateDocument(updatedRecord);
    } catch (error) {
      if (error instanceof DocumentFileTooLargeError || error instanceof DocumentRelationshipNotFoundError) {
        throw error;
      }
      throw new DocumentEditError();
    } finally {
      this.uploadService.resetProgress();
    }
  }

  getDownloadUrl(record: DocumentRecord): string {
    return this.uploadService.getAuthenticatedUrl(record.pfad);
  }

  isViewable(record: DocumentRecord): boolean {
    return DOCUMENTS_VIEWABLE_TYPES.some((type) => type.toLowerCase() === record.typ.toLowerCase());
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / Math.pow(1024, index);
    return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  async getFieldDomainValues(fieldName: string): Promise<string[]> {
    const layer = this.findDocumentLayer();
    if (!layer) return [];

    await layer.load();

    const field = layer.fields.find((f) => f.name === fieldName);
    if (!field?.domain || field.domain.type !== 'coded-value') return [];

    return field.domain.codedValues.map((cv) => cv.code as string);
  }

  private findDocumentRelationship(layer: FeatureLayer): Relationship | undefined {
    if (!layer.relationships) return undefined;

    return layer.relationships.find((rel) => rel.relatedTableId === DOCUMENTS_LAYER_ID);
  }

  private findDocumentLayer(): FeatureLayer | undefined {
    return this.findLayerById(DOCUMENTS_LAYER_ID);
  }

  private findLayerById(relatedTableId: number): FeatureLayer | undefined {
    const view = this.viewService.activeView();
    if (!view?.map) return undefined;

    const fromLayers = view.map.allLayers.find(
      (l: Layer) => l instanceof FeatureLayer && (l as FeatureLayer).layerId === relatedTableId,
    ) as FeatureLayer | undefined;

    if (fromLayers) return fromLayers;

    const fromTables = view.map.allTables?.find(
      (l: Layer) => l instanceof FeatureLayer && (l as FeatureLayer).layerId === relatedTableId,
    ) as FeatureLayer | undefined;

    return fromTables;
  }

  private getParentKeyValue(graphic: Graphic, relationship: Relationship): string {
    const keyField = relationship.keyField || 'id';
    return graphic.attributes[keyField] ?? '';
  }
}
