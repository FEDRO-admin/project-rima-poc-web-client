import { marker } from '@jsverse/transloco-keys-manager/marker';
import { FatalError } from '../error-handling/base-error';

export class MapLoadError extends FatalError {
  public override message = marker('map.load.error');
}
