import { RecoverableError, SilentError } from '../../error-handling/base-error';

export class StatusLoadError extends SilentError {
  public override message = 'Error loading status record';
}

export class StatusSaveError extends RecoverableError {
  public override message = 'Error saving status record';
}
