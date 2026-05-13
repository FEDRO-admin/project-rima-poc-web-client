import { isDevMode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { FatalError, RecoverableError, SilentError } from './base-error';
import { ErrorHandlerService } from './error-handler.service';

vi.mock('@angular/core', async () => {
  const actual = await vi.importActual('@angular/core');
  return {
    ...actual,
    isDevMode: vi.fn(),
  };
});

class TestSilentError extends SilentError {
  public override message = 'silent error';
}

class TestRecoverableError extends RecoverableError {
  public override message = 'recoverable error';
}

class TestFatalError extends FatalError {
  public override message = 'fatal error';
  public override translationArguments: Record<'layerName', string>;

  constructor(layerName: string, originalError?: unknown) {
    super(originalError);
    this.translationArguments = { layerName };
  }
}

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let routerNavigateSpy: ReturnType<typeof vi.fn>;
  let isDevModeSpy: ReturnType<typeof vi.mocked<typeof isDevMode>>;

  beforeEach(() => {
    routerNavigateSpy = vi.fn().mockResolvedValue(true);
    const routerSpyObj = { navigate: routerNavigateSpy };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerSpyObj },
        {
          provide: TranslocoService,
          useValue: {
            translate: (message: string): string => `translated: ${message}`,
            langChanges$: of('de'),
          },
        },
      ],
    });
    service = TestBed.inject(ErrorHandlerService);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    isDevModeSpy = vi.mocked(isDevMode);
    isDevModeSpy.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('handles SilentErrors correctly', () => {
    const testError = new TestSilentError();

    service.handleError(testError);

    expect(routerNavigateSpy).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('handles RecoverableErrors correctly', () => {
    const testErrorMessage = 'error message';
    const testError = new TestRecoverableError(testErrorMessage);

    service.handleError(testError);

    expect(routerNavigateSpy).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('handles FatalErrors correctly', async (): Promise<void> => {
    const testErrorMessage = 'error message';
    const testError = new TestFatalError(testErrorMessage);

    service.handleError(testError);
    await vi.waitFor(() => expect(routerNavigateSpy).toHaveBeenCalled());

    expect(routerNavigateSpy).toHaveBeenCalledExactlyOnceWith(['/error'], {
      queryParams: { error: 'translated: fatal error' },
      skipLocationChange: true,
    });
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('handles non RimaErrors correctly', async (): Promise<void> => {
    const testError = new Error('error message');

    service.handleError(testError);
    await vi.waitFor(() => expect(routerNavigateSpy).toHaveBeenCalled());

    expect(routerNavigateSpy).toHaveBeenCalledExactlyOnceWith(['/error'], {
      queryParams: { error: 'error message' },
      skipLocationChange: true,
    });
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('logs a non-RimaError to the console', async (): Promise<void> => {
    isDevModeSpy.mockReturnValue(true);
    const testError = new Error();

    service.handleError(testError);
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledExactlyOnceWith(testError, '');
  });

  it('logs a RimaError to the console if it has no wrapped error', async (): Promise<void> => {
    isDevModeSpy.mockReturnValue(true);
    const testError = new TestSilentError();

    service.handleError(testError);
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledExactlyOnceWith(testError, 'translated: silent error');
  });

  it('logs a RimaError to the console and also logs a wrapped error', async (): Promise<void> => {
    isDevModeSpy.mockReturnValue(true);
    const testWrappedError = new Error('Test Error in Wrap');
    const testError = new TestRecoverableError(testWrappedError);

    service.handleError(testError);
    await vi.waitFor(() => expect(console.error).toHaveBeenCalledTimes(2));

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(testError, 'translated: recoverable error');
    expect(console.error).toHaveBeenLastCalledWith('Original error was:', testWrappedError);
  });
});
