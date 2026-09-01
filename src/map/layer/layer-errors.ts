import { RecoverableError } from '../../error-handling/base-error';

export class LayerNameNotFoundError extends RecoverableError {
  public override message = 'error.layer.name-not-found';
  public override translationArguments: Record<'layerName', string>;

  constructor(layerName: string) {
    super();
    this.translationArguments = { layerName };
  }
}

export class LayerIdNotFoundError extends RecoverableError {
  public override message = 'error.layer.id-not-found';
  public override translationArguments: Record<'layerId', string>;

  constructor(layerId: number) {
    super();
    this.translationArguments = { layerId: String(layerId) };
  }
}

export class LayerNameCollisionError extends RecoverableError {
  public override message = 'error.layer.name-collision';
  public override translationArguments: Record<'layerName', string>;

  constructor(layerName: string) {
    super();
    this.translationArguments = { layerName };
  }
}
