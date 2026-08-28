import { FatalError } from '../../../error-handling/base-error';

export class BasemapLoadError extends FatalError {
  public override message = 'Failed to load basemaps from portal';
}

export class Default3DBasemapMissingError extends FatalError {
  public override message = 'No default 3D basemap configured in portal organization settings';
}
