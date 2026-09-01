import { RecoverableError } from '../../../error-handling/base-error';

export class ReferencePointSaveError extends RecoverableError {
  public override message = 'error.reference-points.save';
}

export class ReferencePointLoadError extends RecoverableError {
  public override message = 'error.reference-points.load';
}
