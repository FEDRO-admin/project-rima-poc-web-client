import { RecoverableError } from '../../../error-handling/base-error';

export class ReferencePointSaveError extends RecoverableError {
  public override message = 'Error saving reference points';
}

export class ReferencePointLoadError extends RecoverableError {
  public override message = 'Error loading reference points';
}
