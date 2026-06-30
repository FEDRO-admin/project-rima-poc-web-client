import { RecoverableError } from '../../error-handling/base-error';

export class CreateSaveError extends RecoverableError {
  public override message = 'Error saving new feature';
}

export class CreateLayerLoadError extends RecoverableError {
  public override message = 'Error loading feature layer for creation';
}

export class CreateFormLoadError extends RecoverableError {
  public override message = 'Error saving new feature and opening popup for viewing attributes';
}
