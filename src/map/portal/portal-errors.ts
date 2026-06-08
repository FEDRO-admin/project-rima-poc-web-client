import { FatalError, SilentError } from '../../error-handling/base-error';

export class PortalLoadError extends FatalError {
  public override message = 'Portal could not be loaded';
}

export class PortalRestUrlMissingError extends SilentError {
  public override message = 'Portal REST URL is missing';
}
