import { FatalError, RecoverableError } from '../../error-handling/base-error';

export class CatalogSchemaLoadError extends FatalError {
  public override message = 'Catalog schema could not be loaded';
}

export class CatalogWebMapLoadError extends RecoverableError {
  public override message = 'Catalog web map could not be loaded';
}

export class CatalogUndefinedError extends RecoverableError {
  public override message = 'Cannot set the catalog to undefined';
}
