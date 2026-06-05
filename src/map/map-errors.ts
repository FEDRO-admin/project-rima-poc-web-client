import { FatalError, SilentError } from '../error-handling/base-error';

export class MapViewInitialiseError extends FatalError {
  public override message = 'Map view could not be loaded';
}

export class MapViewAlreadyRegisteredError extends SilentError {
  public override message = 'A map view has already been registered';
}
