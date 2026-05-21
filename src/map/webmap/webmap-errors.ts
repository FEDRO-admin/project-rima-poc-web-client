import { SilentError } from '../../error-handling/base-error';

export class WebmapIdMissingError extends SilentError {
  public override message = 'Webmap ID is missing';
}

export class WebmapEmptyLayersError extends SilentError {
  public override message = 'Webmap has no operational layers';
}

export class WebmapCategoriesMissingError extends SilentError {
  public override message = 'Webmap is not assigned to any categories';
}
