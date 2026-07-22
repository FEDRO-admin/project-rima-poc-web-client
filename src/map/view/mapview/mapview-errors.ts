import { Language } from '../../../i18n/language';
import { FatalError, RecoverableError } from '../../../error-handling/base-error';

export class MapViewInitialisationError extends FatalError {
  public override message = 'Error initializing map view';
}

export class MapViewLayerAddError extends FatalError {
  public override message = 'Failed to add layers to the map';
}

export class MapViewCatalogLoadError extends RecoverableError {
  public override message = 'Catalog web map could not be loaded';
}

export class MapViewCatalogUndefinedError extends RecoverableError {
  public override message = 'Cannot set the catalog to undefined';
}

export class MapViewLanguageCategoryMissingError extends FatalError {
  public override message = 'No portal category mapping found for language';
  public override translationArguments: Record<'language', string>;

  constructor(language: Language) {
    super();
    this.translationArguments = { language };
  }
}
