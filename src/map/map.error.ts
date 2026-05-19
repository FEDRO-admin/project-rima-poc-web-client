import { marker } from '@jsverse/transloco-keys-manager/marker';
import { FatalError, SilentError } from '../error-handling/base-error';

export class MapLoadError extends FatalError {
  public override message = marker('map.load.error');
}

export class MapElementLoadError extends FatalError {
  public override message = 'Map element could not be loaded';
}

export class MapViewLoadError extends FatalError {
  public override message = 'Map view could not be loaded';
}

export class MapViewAlreadyRegisteredError extends SilentError {
  public override message = 'A map view has already been registered';
}

export class MapViewNotRegisteredError extends FatalError {
  public override message = 'No map view has been registered yet';
}

export class WebMapLoadError extends FatalError {
  public override message = 'Webmap could not be loaded';
}
