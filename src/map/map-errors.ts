import { FatalError, SilentError } from '../error-handling/base-error';

export class MapViewInitialiseError extends FatalError {
  public override message = 'error.map.view-load';
}

export class MapViewAlreadyRegisteredError extends SilentError {
  public override message = 'error.map.already-registered';
}
