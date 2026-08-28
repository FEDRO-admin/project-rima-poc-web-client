import { RecoverableError } from '../../error-handling/base-error';

export class RbbsCalculationError extends RecoverableError {
  public override message = 'Error calculating RBBS values';
}

export class RbbsSaveError extends RecoverableError {
  public override message = 'Error saving RBBS values to feature';
}
