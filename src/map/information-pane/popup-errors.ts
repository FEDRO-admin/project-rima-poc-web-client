import { SilentError } from '../../error-handling/base-error';

export class PopupInitialisationError extends SilentError {
  public override message = 'Error initializing popup';
}

export class PopupHighlightError extends SilentError {
  public override message = 'Error highlighting popup';
}

export class PopupRefreshError extends SilentError {
  public override message = 'Error refreshing popup feature';
}
