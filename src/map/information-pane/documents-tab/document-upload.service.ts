import { inject, Injectable, signal, Signal } from '@angular/core';
import type Portal from '@arcgis/core/portal/Portal';
import PortalFolder from '@arcgis/core/portal/PortalFolder';
import esriRequest from '@arcgis/core/request';
import esriId from '@arcgis/core/identity/IdentityManager';
import { PortalService } from '../../portal/portal.service';
import { DocumentSharingOptions } from './document-types';
import { DOCUMENTS_PORTAL_FOLDER, DOCUMENTS_PORTAL_TYPE_MAP } from './documents-config';
import { DocumentUploadError, DocumentUnsupportedFileTypeError } from './documents-errors';

export interface UploadProgress {
  state: 'idle' | 'uploading' | 'sharing' | 'done' | 'error';
  percent: number;
}

@Injectable({
  providedIn: 'root',
})
export class DocumentUploadService {
  private readonly portalService = inject(PortalService);

  private readonly writableProgress = signal<UploadProgress>({ state: 'idle', percent: 0 });
  public readonly progress: Signal<UploadProgress> = this.writableProgress.asReadonly();

  async uploadFile(file: File, title: string, sharing: DocumentSharingOptions, parentId: string): Promise<string> {
    const portalType = this.mapFileTypeToPortalType(file);
    if (!portalType) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      throw new DocumentUnsupportedFileTypeError(ext);
    }

    this.writableProgress.set({ state: 'uploading', percent: 0 });

    try {
      const portal = await this.portalService.getPortal();
      const folder = await this.ensurePortalFolder(portal);
      const username = portal.user?.username;

      if (!username || !portal.restUrl) {
        throw new DocumentUploadError();
      }

      const folderId = folder?.id;
      const addUrl = folderId
        ? `${portal.restUrl}/content/users/${username}/${folderId}/addItem`
        : `${portal.restUrl}/content/users/${username}/addItem`;

      const token = esriId.findCredential(portal.restUrl)?.token;
      const itemId = await this.uploadWithProgress(addUrl, file, token, parentId);

      this.writableProgress.set({ state: 'sharing', percent: 100 });
      await this.shareItem(portal.restUrl, username, itemId, sharing, folderId);

      this.writableProgress.set({ state: 'done', percent: 100 });

      const downloadUrl = `${portal.restUrl}/content/items/${itemId}/data`;
      return downloadUrl;
    } catch (error) {
      this.writableProgress.set({ state: 'error', percent: 0 });
      if (error instanceof DocumentUploadError) throw error;
      throw new DocumentUploadError(error);
    }
  }

  async replaceFile(
    oldPfad: string,
    newFile: File,
    title: string,
    sharing: DocumentSharingOptions,
    parentId: string,
  ): Promise<string> {
    return this.uploadFile(newFile, title, sharing, parentId);
  }

  async fetchUserGroups(): Promise<{ id: string; title: string }[]> {
    return [];
  }

  getAuthenticatedUrl(pfad: string): string {
    const credential = esriId.findCredential(pfad);
    if (credential?.token) {
      const separator = pfad.includes('?') ? '&' : '?';
      return `${pfad}${separator}token=${credential.token}`;
    }
    return pfad;
  }

  resetProgress(): void {
    this.writableProgress.set({ state: 'idle', percent: 0 });
  }

  private uploadWithProgress(url: string, file: File, token: string | undefined, parentId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cleanParentId = parentId.replace(/[{}]/g, '');
      const uniqueId = `${cleanParentId}-${Date.now()}`;
      const extension = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
      const portalFilename = `${uniqueId}${extension}`;
      const formData = new FormData();
      formData.append('file', file, portalFilename);
      formData.append('title', portalFilename);
      formData.append('filename', portalFilename);
      formData.append('f', 'json');

      const portalType = this.mapFileTypeToPortalType(file);
      if (portalType) {
        formData.append('type', portalType);
      }

      if (token) {
        formData.append('token', token);
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          this.writableProgress.set({ state: 'uploading', percent });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.id) {
              resolve(response.id);
            } else {
              const detail = response.error?.message || response.status || 'Unknown portal error';
              console.error('[Documents] Portal response (no id):', response);
              reject(new DocumentUploadError(detail));
            }
          } catch {
            console.error('[Documents] Portal response (parse error):', xhr.responseText);
            reject(new DocumentUploadError('Invalid response from portal'));
          }
        } else {
          console.error('[Documents] Portal HTTP error:', xhr.status, xhr.responseText);
          reject(new DocumentUploadError(`HTTP ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new DocumentUploadError()));
      xhr.addEventListener('abort', () => reject(new DocumentUploadError()));

      xhr.send(formData);
    });
  }

  private async shareItem(
    restUrl: string,
    username: string,
    itemId: string,
    sharing: DocumentSharingOptions,
    folderId?: string,
  ): Promise<void> {
    if (sharing.access === 'private') return;

    const basePath = folderId
      ? `${restUrl}/content/users/${username}/${folderId}`
      : `${restUrl}/content/users/${username}`;
    const shareUrl = `${basePath}/items/${itemId}/share`;

    const query: Record<string, string> = {
      everyone: sharing.access === 'public' ? 'true' : 'false',
      org: sharing.access === 'org' || sharing.access === 'public' ? 'true' : 'false',
      f: 'json',
    };

    await esriRequest(shareUrl, { method: 'post', query });
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
      query: { title: DOCUMENTS_PORTAL_FOLDER, f: 'json' },
    });
    if (response.data?.folder) {
      return response.data.folder as PortalFolder;
    }
    return undefined;
  }

  private extractPortalItemId(pfad: string): string | undefined {
    const match = pfad.match(/content\/items\/([a-f0-9]+)/i);
    return match?.[1];
  }

  private mapFileTypeToPortalType(file: File): string | undefined {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return DOCUMENTS_PORTAL_TYPE_MAP[extension];
  }
}
