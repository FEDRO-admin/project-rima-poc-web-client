import { RecoverableError, SilentError } from '../../../error-handling/base-error';

export class AttributeEditSaveError extends RecoverableError {
  public override message = 'Error saving feature edits';
}

export class AttributeEditRefreshError extends SilentError {
  public override message = 'Error refreshing feature after edit';
}

export class AttributeCreateSaveError extends RecoverableError {
  public override message = 'Error saving new feature';
}

export class AttributeCreateOpenError extends RecoverableError {
  public override message = 'Error opening popup after creating feature';
}

export class AttributeDeleteError extends RecoverableError {
  public override message = 'Error deleting feature';
}
