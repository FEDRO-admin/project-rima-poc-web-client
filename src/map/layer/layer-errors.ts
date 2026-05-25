import { FatalError } from '../../error-handling/base-error';

export class LayerBuildError extends FatalError {
  public override message = 'Failed to build map layers from the catalog';
}

export class LayerAddError extends FatalError {
  public override message = 'Failed to add layers to the map';
}
