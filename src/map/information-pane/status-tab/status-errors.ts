import { RecoverableError, SilentError } from '../../../error-handling/base-error';

export class StatusLoadError extends SilentError {
  public override message = 'error.status.load';
}

export class StatusSaveError extends RecoverableError {
  public override message = 'error.status.save';
}
