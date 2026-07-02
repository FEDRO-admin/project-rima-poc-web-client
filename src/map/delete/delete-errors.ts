import { RecoverableError } from '../../error-handling/base-error';

export class DeleteFeatureError extends RecoverableError {
  public override message = 'Error deleting feature';
}
