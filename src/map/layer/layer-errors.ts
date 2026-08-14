import { RecoverableError } from '../../error-handling/base-error';

export class LayerNameNotFoundError extends RecoverableError {
  public override message: string;

  constructor(layerName: string) {
    super();
    this.message = `Layer name "${layerName}" not found in any registered feature service`;
  }
}

export class LayerIdNotFoundError extends RecoverableError {
  public override message: string;

  constructor(layerId: number) {
    super();
    this.message = `Layer ID ${layerId} not found in any registered feature service`;
  }
}

export class LayerNameCollisionError extends RecoverableError {
  public override message: string;

  constructor(layerName: string) {
    super();
    this.message = `Layer name "${layerName}" exists in multiple feature services with different IDs`;
  }
}
