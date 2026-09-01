import { FatalError, SilentError } from '../../error-handling/base-error';

export class PortalLoadError extends FatalError {
  public override message = 'error.portal.load';
}

export class PortalRestUrlMissingError extends SilentError {
  public override message = 'error.portal.rest-url-missing';
}
