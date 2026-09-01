import { Language } from '../../../i18n/language';
import { FatalError, RecoverableError } from '../../../error-handling/base-error';

export class MapViewInitialisationError extends FatalError {
  public override message = 'error.mapview.init';
}

export class MapViewLoadLayersError extends RecoverableError {
  public override message = 'error.mapview.layers-load';
}

export class MapViewLayerAddError extends FatalError {
  public override message = 'error.mapview.layers-add';
}

export class MapViewLanguageCategoryMissingError extends FatalError {
  public override message = 'error.mapview.language-category';
  public override translationArguments: Record<'language', string>;

  constructor(language: Language) {
    super();
    this.translationArguments = { language };
  }
}
