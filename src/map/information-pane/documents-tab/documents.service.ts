import { inject, Injectable } from '@angular/core';
import esriRequest from '@arcgis/core/request';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Layer from '@arcgis/core/layers/Layer';
import Graphic from '@arcgis/core/Graphic';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type Relationship from '@arcgis/core/layers/support/Relationship';
import type Point from '@arcgis/core/geometry/Point';
import { ViewService } from '../../view/view.service';
import { HistoryStore } from '../../history/history.store';
import { PortalService } from '../../portal/portal.service';
import { DocumentsStore } from './documents.store';
import { DocumentUploadService } from './document-upload.service';
import { DocumentEditPayload, DocumentRecord, DocumentUploadPayload } from './document-types';
import {
  DOCUMENT_AUTO_POPULATED_FIELDS,
  DOCUMENTS_LAYER_NAME,
  DOCUMENTS_MAP_LAYER_TITLE,
  DOCUMENTS_MAX_FILE_SIZE_MB,
  DOCUMENTS_VIEWABLE_TYPES,
} from './documents-config';
import {
  DocumentDeleteError,
  DocumentEditError,
  DocumentFileTooLargeError,
  DocumentQueryError,
  DocumentRelationshipNotFoundError,
  DocumentUploadError,
} from './documents-errors';
import { AttributeEditField } from '../../shared/attribute-edit-field';
import { buildEditAttributeField } from '../../layer/layer-attribute-domain-resolver';
import { isImmutableField } from '../../layer/layer-attributes';
import { LayerIdResolver } from '../../layer/layer-id-resolver';
import type { AttributeValue } from '../../shared/attribute-value-conversion';

@Injectable({
  providedIn: 'root',
})
export class DocumentsService {
  private readonly viewService = inject(ViewService);
  private readonly historyStore = inject(HistoryStore);
  private readonly portalService = inject(PortalService);
  private readonly documentsStore = inject(DocumentsStore);
  private readonly uploadService = inject(DocumentUploadService);
  private readonly layerIdResolver = inject(LayerIdResolver);

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
        returnGeometry: true,
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

      const documents: DocumentRecord[] = featureSet.features.map((f: Graphic) => ({
        objectId: f.attributes[objectIdField],
        attributes: { ...f.attributes },
        geometry: (f.geometry as Point) ?? undefined,
      }));

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
      const portal = await this.portalService.getPortal();
      const user = portal.user!;
      const parentKeyValue = this.getParentKeyValue(graphic, relationship);
      const titel = (payload.editableAttributes['titel'] as string) ?? '';

      const downloadUrl = await this.uploadService.uploadFile(payload.file, titel, payload.sharing, parentKeyValue);

      /* eslint-disable @typescript-eslint/naming-convention -- Feature service attribute names must match the backend schema. */
      const attributes: Record<string, AttributeValue> = {
        ...payload.editableAttributes,
        id: crypto.randomUUID(),
        fk_parent: parentKeyValue,
        parent_class_name: await this.resolveParentClassName(layer),
        pfad: downloadUrl,
        name: payload.file.name,
        groesse: payload.file.size,
        autor: user.fullName ?? user.username ?? '',
        letzte_aenderung: Date.now(),
        anzahl_seiten: null,
      };
      /* eslint-enable @typescript-eslint/naming-convention -- Re-enable after feature service attributes. */

      const newGraphic = new Graphic({ attributes, geometry: payload.geometry ?? undefined });
      const editResult = await documentLayer.applyEdits({ addFeatures: [newGraphic] });

      if (editResult.addFeatureResults[0]?.error) {
        throw new DocumentUploadError(editResult.addFeatureResults[0].error);
      }

      const newObjectId = editResult.addFeatureResults[0]?.objectId ?? 0;
      this.documentsStore.addDocument({
        objectId: newObjectId,
        attributes: { ...attributes, [documentLayer.objectIdField]: newObjectId },
        geometry: payload.geometry,
      });
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
      let fileAttributes: Record<string, AttributeValue> = {};

      if (payload.file && payload.sharing) {
        const currentPfad = (record.attributes['pfad'] as string) ?? '';
        const titel = (payload.editableAttributes['titel'] as string) ?? '';
        const fkParent = (record.attributes['fk_parent'] as string) ?? '';

        const newPfad = await this.uploadService.replaceFile(
          currentPfad,
          payload.file,
          titel,
          payload.sharing,
          fkParent,
        );
        fileAttributes = {
          pfad: newPfad,
          groesse: payload.file.size,
          name: payload.file.name,
        };
      }

      /* eslint-disable @typescript-eslint/naming-convention -- Feature service attribute names must match the backend schema. */
      const updatedAttributes: Record<string, AttributeValue> = {
        ...record.attributes,
        ...payload.editableAttributes,
        ...fileAttributes,
        letzte_aenderung: Date.now(),
      };
      /* eslint-enable @typescript-eslint/naming-convention -- Re-enable after feature service attributes. */

      const updateGraphic = new Graphic({
        attributes: { [documentLayer.objectIdField]: record.objectId, ...updatedAttributes },
        geometry: payload.geometry ?? record.geometry ?? undefined,
      });
      const editResult = await documentLayer.applyEdits({ updateFeatures: [updateGraphic] });

      if (editResult.updateFeatureResults[0]?.error) {
        throw new DocumentEditError();
      }

      this.documentsStore.updateDocument({
        objectId: record.objectId,
        attributes: updatedAttributes,
        geometry: payload.geometry !== undefined ? payload.geometry : record.geometry,
      });
    } catch (error) {
      if (error instanceof DocumentFileTooLargeError || error instanceof DocumentRelationshipNotFoundError) {
        throw error;
      }
      throw new DocumentEditError();
    } finally {
      this.uploadService.resetProgress();
    }
  }

  async downloadDocument(record: DocumentRecord): Promise<void> {
    const pfad = (record.attributes['pfad'] as string) ?? '';
    const name = (record.attributes['name'] as string) || '';
    const response = await esriRequest(pfad, { responseType: 'native' });
    const blob = await (response.data as Response).blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }

  getDownloadUrl(record: DocumentRecord): string {
    return this.uploadService.getAuthenticatedUrl((record.attributes['pfad'] as string) ?? '');
  }

  isViewable(record: DocumentRecord): boolean {
    const typ = (record.attributes['typ'] as string) ?? '';
    return DOCUMENTS_VIEWABLE_TYPES.some((t) => t.toLowerCase() === typ.toLowerCase());
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / Math.pow(1024, index);
    return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  resolveEditableFields(): AttributeEditField[] {
    const layer = this.findDocumentLayer();
    if (!layer?.fields?.length) return [];

    return layer.fields
      .filter(
        (field) =>
          !isImmutableField(field.name, layer) && !DOCUMENT_AUTO_POPULATED_FIELDS.includes(field.name.toLowerCase()),
      )
      .map((field) => buildEditAttributeField(field));
  }

  private findDocumentRelationship(layer: FeatureLayer): Relationship | undefined {
    if (!layer.relationships) return undefined;

    const docLayer = this.findDocumentLayer();
    if (!docLayer) return undefined;

    return layer.relationships.find((rel) => rel.role === 'origin' && rel.relatedTableId === docLayer.layerId);
  }

  private findDocumentLayer(): FeatureLayer | undefined {
    const view = this.viewService.activeView();
    if (!view?.map) return undefined;

    const byTitle = view.map.allLayers.find(
      (l: Layer) => l instanceof FeatureLayer && l.title === DOCUMENTS_MAP_LAYER_TITLE,
    ) as FeatureLayer | undefined;

    return byTitle ?? this.findLayerByName();
  }

  private findLayerByName(): FeatureLayer | undefined {
    try {
      return this.findLayerById(this.layerIdResolver.resolveId(DOCUMENTS_LAYER_NAME));
    } catch {
      return undefined;
    }
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

  private async resolveParentClassName(layer: FeatureLayer): Promise<string> {
    const view = this.viewService.activeView();
    if (!view?.map) return layer.title ?? '';
    try {
      return await this.layerIdResolver.resolveNameAsync(layer.layerId, view.map);
    } catch {
      return layer.title ?? '';
    }
  }
}
