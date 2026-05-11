import { Injectable } from '@angular/core';
import { achsenLayer } from './definitions/achsen.layer';
import { RimaLayerConfig } from './rima-layer';

// dont forget to import and add the layers here to make them available in the app

@Injectable({ providedIn: 'root' })
export class RimaLayersService {
  readonly achsen = achsenLayer;

  // maybe in the future we want a switch for i18n...?
  // readonly de: RimaLayerConfig[] = [this.achsen, ...];
  // readonly en: RimaLayerConfig[] = [this.axis, ...];
  readonly all: RimaLayerConfig[] = [this.achsen];
}
