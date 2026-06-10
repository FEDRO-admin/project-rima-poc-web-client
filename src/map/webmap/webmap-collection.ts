import { LoadingState } from '../loading-state';
import { WebmapData } from './webmap-data';

export interface WebmapCollection {
  loadState: LoadingState;
  readonly webmaps: WebmapData[];
}
