import { FatalError } from '../../error-handling/base-error';

export class SceneViewInitialisationError extends FatalError {
  public override message = 'Error initializing 3D scene view';
}
