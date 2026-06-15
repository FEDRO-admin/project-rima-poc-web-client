import { FatalError } from '../../error-handling/base-error';

export class PopupInitialisationError extends FatalError {
  public override message = 'Error initializing popup';
}

export class PopupHighlightError extends FatalError {
  public override message = 'Error highlighting popup';
}
