import { RecoverableError, SilentError } from '../../../error-handling/base-error';

export class AttributeEditSaveError extends RecoverableError {
  public override message = 'error.attributes.save';
}

export class AttributeEditRefreshError extends SilentError {
  public override message = 'error.attributes.refresh';
}

export class AttributeCreateSaveError extends RecoverableError {
  public override message = 'error.attributes.create-save';
}

export class AttributeCreateOpenError extends RecoverableError {
  public override message = 'error.attributes.create-open';
}

export class AttributeDeleteError extends RecoverableError {
  public override message = 'error.attributes.delete';
}
