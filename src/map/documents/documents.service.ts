import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Polyline from '@arcgis/core/geometry/Polyline';
import type Geometry from '@arcgis/core/geometry/Geometry';
import type Portal from '@arcgis/core/portal/Portal';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type Relationship from '@arcgis/core/layers/support/Relationship';
import PortalItem from '@arcgis/core/portal/PortalItem';
import PortalFolder from '@arcgis/core/portal/PortalFolder';
import esriRequest from '@arcgis/core/request';
import { MapViewService } from '../view/view.service';
import { HistoryStore } from '../history/history.store';
import { PortalService } from '../portal/portal.service';
import { DocumentsStore } from './documents.store';
import { DOCUMENT_FIELDS, DocumentRecord, DocumentUploadPayload, mapGraphicToDocumentRecord } from './document-types';
import {
  DOCUMENTS_MAX_FILE_SIZE_MB,
  DOCUMENTS_PORTAL_FOLDER,
  DOCUMENTS_TABLE_NAME,
  DOCUMENTS_VIEWABLE_TYPES,
} from './documents-config';
import {
  DocumentDeleteError,
  DocumentFileTooLargeError,
  DocumentQueryError,
  DocumentRelationshipNotFoundError,
  DocumentUploadError,
} from './documents-errors';

@Injectable({
  providedIn: 'root',
})
export class DocumentsService {
  private readonly viewService = inject(MapViewService);
  private readonly historyStore = inject(HistoryStore);
  private readonly portalService = inject(PortalService);
  private readonly documentsStore = inject(DocumentsStore);

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

      const documentLayer = this.findDocumentLayer(relationship);
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

    const documentLayer = this.findDocumentLayer(relationship);
    if (!documentLayer) {
      throw new DocumentRelationshipNotFoundError();
    }

    this.documentsStore.setUploading(true);

    try {
      const portal = await this.portalService.getPortal();
      const folder = await this.ensurePortalFolder(portal);

      const portalItem = new PortalItem({
        portal,
        title: payload.titel || payload.file.name,
        type: this.mapFileTypeToPortalType(payload.file),
        name: payload.file.name,
      });

      const user = portal.user!;
      const addResult = await user.addItem({
        item: portalItem,
        data: payload.file,
        folder: folder?.id,
      });

      if (!addResult?.id) {
        throw new DocumentUploadError();
      }

      const downloadUrl = `${portal.restUrl}/content/items/${addResult.id}/data`;
      const parentGlobalId = this.getGlobalId(graphic, layer);
      const geometry = this.getGeometryForDocument(graphic);

      const attributes: Record<string, unknown> = {
        [DOCUMENT_FIELDS.id]: this.generateGuid(),
        [DOCUMENT_FIELDS.name]: payload.file.name,
        [DOCUMENT_FIELDS.fkParent]: parentGlobalId,
        [DOCUMENT_FIELDS.parentClassName]: layer.title ?? '',
        [DOCUMENT_FIELDS.titel]: payload.titel,
        [DOCUMENT_FIELDS.beschreibung]: payload.beschreibung,
        [DOCUMENT_FIELDS.autor]: user.fullName ?? user.username ?? '',
        [DOCUMENT_FIELDS.typ]: payload.typ,
        [DOCUMENT_FIELDS.pfad]: downloadUrl,
        [DOCUMENT_FIELDS.status]: payload.status,
        [DOCUMENT_FIELDS.letzteAenderung]: Date.now(),
        [DOCUMENT_FIELDS.version]: payload.version,
        [DOCUMENT_FIELDS.groesse]: payload.file.size,
        [DOCUMENT_FIELDS.anzahlSeiten]: null,
      };

      const newGraphic = new Graphic({ attributes, geometry });
      const editResult = await documentLayer.applyEdits({ addFeatures: [newGraphic] });

      if (editResult.addFeatureResults[0]?.error) {
        throw new DocumentUploadError(editResult.addFeatureResults[0].error);
      }

      const newObjectId = editResult.addFeatureResults[0]?.objectId ?? 0;
      const documentRecord: DocumentRecord = {
        objectId: newObjectId,
        id: attributes['id'] as string,
        name: attributes['name'] as string,
        fkParent: parentGlobalId,
        parentClassName: attributes['parent_class_name'] as string,
        titel: payload.titel,
        beschreibung: payload.beschreibung,
        autor: attributes['autor'] as string,
        typ: payload.typ,
        pfad: downloadUrl,
        status: payload.status,
        letzteAenderung: new Date(),
        version: payload.version,
        groesse: payload.file.size,
        anzahlSeiten: null,
      };

      this.documentsStore.addDocument(documentRecord);
    } catch (error) {
      if (error instanceof DocumentFileTooLargeError || error instanceof DocumentRelationshipNotFoundError) {
        throw error;
      }
      throw new DocumentUploadError(error);
    } finally {
      this.documentsStore.setUploading(false);
    }
  }

  async deleteDocument(record: DocumentRecord, graphic: Graphic): Promise<void> {
    const layer = graphic.layer as FeatureLayer;
    const relationship = this.findDocumentRelationship(layer);
    if (!relationship) {
      throw new DocumentRelationshipNotFoundError();
    }

    const documentLayer = this.findDocumentLayer(relationship);
    if (!documentLayer) {
      throw new DocumentRelationshipNotFoundError();
    }

    this.documentsStore.setDeleting(true);

    try {
      await this.deletePortalItem(record.pfad);

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

  getDownloadUrl(record: DocumentRecord): string {
    return record.pfad;
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

  private findDocumentRelationship(layer: FeatureLayer): Relationship | undefined {
    if (!layer.relationships) return undefined;

    return layer.relationships.find((rel) => {
      const relatedLayer = this.findLayerById(rel.relatedTableId);
      if (!relatedLayer) return false;
      const layerTitle = relatedLayer.title?.toLowerCase() ?? '';
      const layerUrl = relatedLayer.url?.toLowerCase() ?? '';
      return layerTitle.includes(DOCUMENTS_TABLE_NAME) || layerUrl.includes(DOCUMENTS_TABLE_NAME);
    });
  }

  private findDocumentLayer(relationship: Relationship): FeatureLayer | undefined {
    return this.findLayerById(relationship.relatedTableId);
  }

  private findLayerById(relatedTableId: number): FeatureLayer | undefined {
    const view = this.viewService.mapView();
    if (!view?.map) return undefined;

    const fromLayers = view.map.allLayers.find(
      (l) => l instanceof FeatureLayer && (l as FeatureLayer).layerId === relatedTableId,
    ) as FeatureLayer | undefined;

    if (fromLayers) return fromLayers;

    const fromTables = view.map.allTables?.find(
      (l) => l instanceof FeatureLayer && (l as FeatureLayer).layerId === relatedTableId,
    ) as FeatureLayer | undefined;

    return fromTables;
  }

  private async ensurePortalFolder(portal: Portal): Promise<PortalFolder | undefined> {
    if (!portal.user) return undefined;
    const folders: PortalFolder[] = await portal.user.fetchFolders();
    const existing = folders.find((f) => f.title === DOCUMENTS_PORTAL_FOLDER);
    if (existing) return existing;

    const restUrl = portal.restUrl;
    const username = portal.user.username;
    const response = await esriRequest(`${restUrl}/content/users/${username}/createFolder`, {
      method: 'post',
      query: {
        title: DOCUMENTS_PORTAL_FOLDER,
        f: 'json',
      },
    });
    if (response.data?.folder) {
      return response.data.folder as PortalFolder;
    }
    return undefined;
  }

  private async deletePortalItem(pfad: string): Promise<void> {
    const itemId = this.extractPortalItemId(pfad);
    if (!itemId) return;

    try {
      const portal = await this.portalService.getPortal();
      if (!portal.user) return;
      const item = new PortalItem({ portal, id: itemId });
      await item.load();
      await portal.user.deleteItems([item]);
    } catch {
      // Portal item may already be deleted or inaccessible — proceed with record deletion
    }
  }

  private extractPortalItemId(pfad: string): string | undefined {
    const match = pfad.match(/content\/items\/([a-f0-9]+)/i);
    return match?.[1];
  }

  private getGlobalId(graphic: Graphic, layer: FeatureLayer): string {
    const globalIdField = layer.globalIdField || 'globalid';
    return graphic.attributes[globalIdField] ?? '';
  }

  private getGeometryForDocument(graphic: Graphic): Geometry | undefined {
    if (!graphic.geometry) return undefined;

    switch (graphic.geometry.type) {
      case 'point':
        return graphic.geometry;
      case 'polygon': {
        const centroid = (graphic.geometry as Polygon).centroid;
        return centroid ?? undefined;
      }
      case 'polyline': {
        const polyline = graphic.geometry as Polyline;
        const midPath = polyline.paths[0];
        if (midPath && midPath.length > 0) {
          const midIndex = Math.floor(midPath.length / 2);
          const [x, y] = midPath[midIndex];
          return new Point({ x, y, spatialReference: polyline.spatialReference });
        }
        return undefined;
      }
      case 'multipoint':
      case 'extent':
      case 'mesh':
        return undefined;
    }
  }

  private generateGuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private mapFileTypeToPortalType(file: File): string {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const typeMap: Record<string, string> = {
      pdf: 'PDF',
      doc: 'Microsoft Word',
      docx: 'Microsoft Word',
      xls: 'Microsoft Excel',
      xlsx: 'Microsoft Excel',
      ppt: 'Microsoft Powerpoint',
      pptx: 'Microsoft Powerpoint',
      png: 'Image',
      jpg: 'Image',
      jpeg: 'Image',
      gif: 'Image',
      tif: 'Image',
      tiff: 'Image',
      zip: 'File',
      csv: 'CSV',
      txt: 'Document Link',
    };
    return typeMap[extension] ?? 'File';
  }
}
