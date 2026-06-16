import { RecoverableError, SilentError } from '../../error-handling/base-error';

export class EditSaveError extends RecoverableError {
  public override message = 'Error saving feature edits';
}

export class EditRefreshError extends SilentError {
  public override message = 'Error refreshing feature after edit';
}
