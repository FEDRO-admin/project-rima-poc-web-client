abstract class RimaError extends Error {
  public readonly originalError?: unknown;
  public translationArguments: Record<string, string> | undefined = undefined;

  constructor(originalError?: unknown) {
    super();
    this.originalError = originalError;
  }
}

export function isOfTypeRimaError(error: unknown): error is RimaError {
  return error instanceof RimaError;
}

/**
 * A fatal error prevents the app from being used further and displays an error page.
 */
export abstract class FatalError extends RimaError {}

/**
 * A recoverable error only triggers a notification, but does not prevent the app from being used further.
 */
export abstract class RecoverableError extends RimaError {}

/**
 * A silent error is logged in dev mode, but does not trigger any visual indication to the user.
 */
export abstract class SilentError extends RimaError {}
