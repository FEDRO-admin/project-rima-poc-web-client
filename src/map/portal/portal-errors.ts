import { SilentError } from '../../error-handling/base-error';

export class PortalRestUrlMissingError extends SilentError {
  public override message = 'Portal REST URL is missing';
}
