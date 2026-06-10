import { WebmapLayer } from './webmap-layer';

export interface WebmapData {
  readonly title: string;
  readonly portalItemId: string;
  readonly categorySegments: string[];
  readonly layers: WebmapLayer[];
}
