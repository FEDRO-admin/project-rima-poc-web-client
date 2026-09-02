import { RecoverableError } from '../../../error-handling/base-error';

export class DocumentQueryError extends RecoverableError {
  override readonly message = 'documents.error.query';
}

export class DocumentUploadError extends RecoverableError {
  override readonly message: string;
  readonly detail?: string;

  constructor(cause?: unknown) {
    super();
    this.detail = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : undefined;
    this.message = this.detail ? `documents.error.upload: ${this.detail}` : 'documents.error.upload';
  }
}

export class DocumentDeleteError extends RecoverableError {
  override readonly message = 'documents.error.delete';
}

export class DocumentEditError extends RecoverableError {
  override readonly message = 'documents.error.edit';
}

export class DocumentFileTooLargeError extends RecoverableError {
  override readonly message = 'documents.error.fileTooLarge';
}

export class DocumentRelationshipNotFoundError extends RecoverableError {
  override readonly message = 'documents.error.relationshipNotFound';
}

export class DocumentUnsupportedFileTypeError extends RecoverableError {
  override readonly message: string;

  constructor(extension: string) {
    super();
    this.message = `documents.error.unsupportedFileType: .${extension}`;
  }
}

export class DocumentDownloadError extends RecoverableError {
  override readonly message = 'documents.error.download';
}
