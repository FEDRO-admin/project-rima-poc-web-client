import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { MapServerService } from '../map/layers/map-server.service';
import { FeatureServerService } from '../map/layers/feature-server.service';
import { MAP_SERVER_URL } from '../map/layers/map-server.config';
import { type LayerTreeNode, type LayerTreeLeaf, isLeafNode, isGroupNode, findLeaf } from '../map/layers/layer-tree';

export type { LayerTreeNode, LayerTreeLeaf };

interface LayersState {
  tree: LayerTreeNode[];
  mapImageLayer: MapImageLayer | null;
}

export const LayersStore = signalStore(
  { providedIn: 'root' },
  withState<LayersState>({ tree: [], mapImageLayer: null }),
  withMethods(
    (store, mapServerService = inject(MapServerService), featureServerService = inject(FeatureServerService)) => {
      const markFeatureServerAvailability = (tree: LayerTreeNode[], availableIds: Set<number>): LayerTreeNode[] =>
        tree.map((node) => {
          if (isLeafNode(node)) {
            return { ...node, hasFeatureServer: availableIds.has(node.id) };
          }
          return { ...node, children: markFeatureServerAvailability(node.children, availableIds) };
        });

      return {
        async initialize(): Promise<void> {
          try {
            const [tree, featureServerIds] = await Promise.all([
              mapServerService.getLayerTree(),
              featureServerService.getAvailableLayerIds(),
            ]);

            const enrichedTree = markFeatureServerAvailability(tree, featureServerIds);

            const mapImageLayer = new MapImageLayer({ url: MAP_SERVER_URL });

            patchState(store, { tree: enrichedTree, mapImageLayer });

            console.warn('[LayersStore] Layers loaded successfully', { tree: enrichedTree });
          } catch (error) {
            console.error('[LayersStore] Failed to load layers from server', error);
          }
        },

        getLeaf(id: number): LayerTreeLeaf | undefined {
          return findLeaf(store.tree(), id);
        },

        getFeatureLayer(leafId: number): FeatureLayer | undefined {
          const leaf = findLeaf(store.tree(), leafId);
          if (!leaf?.hasFeatureServer) return undefined;
          return featureServerService.getFeatureLayer(leafId);
        },
      };
    },
  ),
  withComputed((store) => ({
    hierarchy: computed(() => store.tree()),
  })),
);
