import { SilentError } from '../../error-handling/base-error';

export class PopupInitialisationError extends SilentError {
  public override message = 'error.popup.init';
}

export class PopupHighlightError extends SilentError {
  public override message = 'error.popup.highlight';
}

export class PopupRefreshError extends SilentError {
  public override message = 'error.popup.refresh';
}
