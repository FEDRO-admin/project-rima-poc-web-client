import { FatalError } from '../../../error-handling/base-error';

export class BasemapLoadError extends FatalError {
  public override message = 'error.basemap.load';
}

export class Default3DBasemapMissingError extends FatalError {
  public override message = 'error.basemap.default-3d-missing';
}
