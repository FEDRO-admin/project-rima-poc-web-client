import type Graphic from '@arcgis/core/Graphic';
import type Relationship from '@arcgis/core/layers/support/Relationship';

export interface HierarchyNode {
  graphic: Graphic;
  layerTitle: string;
  displayLabel: string;
  children: HierarchyNode[] | undefined;
  expanded: boolean;
  isClickedFeature: boolean;
  isGroup: boolean;
  childRelationships: Relationship[];
  loading: boolean;
}
