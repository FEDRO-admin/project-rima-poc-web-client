import { FatalError } from '../../error-handling/base-error';

export class ViewInitialisationError extends FatalError {
  public override message = 'Error initializing map view';
}
