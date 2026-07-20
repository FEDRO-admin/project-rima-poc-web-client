import { FatalError, RecoverableError } from '../../error-handling/base-error';

export class SceneViewInitialisationError extends FatalError {
  public override message = 'Error initializing 3D scene view';
}

export class SceneCatalogLoadError extends RecoverableError {
  public override message = 'Error loading 3D scene layers from portal';
}
