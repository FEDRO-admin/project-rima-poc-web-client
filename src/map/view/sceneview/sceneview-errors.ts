import { FatalError, RecoverableError } from '../../../error-handling/base-error';

export class SceneViewInitialisationError extends FatalError {
  public override message = 'error.sceneview.init';
}

export class SceneViewCatalogLoadError extends RecoverableError {
  public override message = 'error.sceneview.catalog-load';
}
