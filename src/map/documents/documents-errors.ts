import { RecoverableError } from '../../error-handling/base-error';

export class DocumentQueryError extends RecoverableError {
  override readonly message = 'documents.error.query';
}

export class DocumentUploadError extends RecoverableError {
  override readonly message = 'documents.error.upload';
}

export class DocumentDeleteError extends RecoverableError {
  override readonly message = 'documents.error.delete';
}

export class DocumentFileTooLargeError extends RecoverableError {
  override readonly message = 'documents.error.fileTooLarge';
}

export class DocumentRelationshipNotFoundError extends RecoverableError {
  override readonly message = 'documents.error.relationshipNotFound';
}
