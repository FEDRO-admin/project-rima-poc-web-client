import { RecoverableError } from '../../error-handling/base-error';

export class RbbsCalculationError extends RecoverableError {
  public override message = 'error.rbbs.calculation';
}

export class RbbsSoeError extends RecoverableError {
  public override message = 'error.rbbs.soe';
  public override translationArguments: Record<'soeMessage', string>;

  constructor(soeMessage: string) {
    super();
    this.translationArguments = { soeMessage };
  }
}

export class RbbsSaveError extends RecoverableError {
  public override message = 'error.rbbs.save';
}
