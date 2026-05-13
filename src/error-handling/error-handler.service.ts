import { ErrorHandler, inject, Injectable, NgZone, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { RecoverableError, SilentError, isOfTypeRimaError } from './base-error';

@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService implements ErrorHandler {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly translocoService = inject(TranslocoService);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- The interface definition of angular error-handlers defines `any` as an argument.
  public handleError(error: any): void {
    void this.handleErrorAsync(error);
  }

  private async handleErrorAsync(error: unknown): Promise<void> {
    const message = await this.extractErrorMessage(error);

    if (isDevMode()) {
      console.error(error, message);
      if (isOfTypeRimaError(error) && error.originalError) {
        console.error('Original error was:', error.originalError);
      }
    }

    if (error instanceof SilentError) {
      // these errors should only be logged to a frontend logging service, but not displayed.
    } else if (error instanceof RecoverableError) {
      // At the moment, recoverable errors are treated the same as silent errors.
    } else {
      await this.routeToErrorPage(message);
    }
  }

  private async extractErrorMessage(error: unknown): Promise<string> {
    try {
      if (error instanceof Error) {
        if (isOfTypeRimaError(error)) {
          // Ensure Transloco has loaded a language before attempting translation
          await firstValueFrom(this.translocoService.langChanges$);
          return this.translocoService.translate(error.message);
        } else {
          return error.message;
        }
      } else {
        return JSON.stringify(error);
      }
    } catch {
      // an error within an error - this is the worst case. Keep the logic as simple as possible
      return 'Unknown error';
    }
  }

  private async routeToErrorPage(message?: string): Promise<void> {
    // sometimes, the error handler is not yet tied to the Angular zone, so we make sure it is run *within* the angular zone.
    await this.zone.run(async () => {
      await this.router.navigate(['/error'], { queryParams: { error: message }, skipLocationChange: true });
    });
  }
}
