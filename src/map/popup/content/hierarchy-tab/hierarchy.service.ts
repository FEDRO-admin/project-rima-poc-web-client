import { inject, Injectable } from '@angular/core';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import RelationshipQuery from '@arcgis/core/rest/support/RelationshipQuery';
import type Relationship from '@arcgis/core/layers/support/Relationship';
import { MapViewService } from '../../../view/view.service';
import { HierarchyNode } from './hierarchy-node';

@Injectable({
  providedIn: 'root',
})
export class HierarchyService {
  private readonly viewService = inject(MapViewService);

  async buildHierarchyTree(graphic: Graphic): Promise<HierarchyNode | undefined> {
    const parentChain = await this.getParentChain(graphic);
    const clickedNode = this.buildNode(graphic, true);
    clickedNode.expanded = true;

    const children = await this.getChildrenRecursive(graphic);
    clickedNode.children = children;

    if (parentChain.length > 0) {
      const root = parentChain[0];
      let current = root;
      current.expanded = true;

      for (let i = 1; i < parentChain.length; i++) {
        parentChain[i].expanded = true;
        current.children = [parentChain[i]];
        current = parentChain[i];
      }

      current.children = [clickedNode];
      return root;
    }

    return clickedNode;
  }

  private async getParentChain(graphic: Graphic): Promise<HierarchyNode[]> {
    const chain: HierarchyNode[] = [];
    let current = graphic;

    while (true) {
      const layer = current.layer as FeatureLayer;
      if (!layer?.relationships?.length) {
        break;
      }

      const parentGraphic = await this.findParent(layer, current);
      if (!parentGraphic) break;

      chain.unshift(this.buildNode(parentGraphic, false));
      current = parentGraphic;
    }

    return chain;
  }

  private async getChildren(graphic: Graphic): Promise<HierarchyNode[]> {
    const layer = graphic.layer as FeatureLayer;
    if (!layer?.relationships?.length) {
      return [];
    }

    const childRelationships = this.findChildRelationships(layer);
    const groups: HierarchyNode[] = [];

    for (const rel of childRelationships) {
      const relatedLayer = this.findLayerByRelationship(rel);
      if (!relatedLayer) {
        continue;
      }

      const relatedFeatures = await this.queryChildren(layer, graphic, rel);
      if (relatedFeatures.length === 0) continue;

      const featureNodes = relatedFeatures.map((f) => this.buildNode(f, false));
      groups.push(this.buildGroupNode(relatedLayer.title ?? '[missing title]', featureNodes));
    }

    return groups;
  }

  private async getChildrenRecursive(graphic: Graphic): Promise<HierarchyNode[]> {
    const groups = await this.getChildren(graphic);
    for (const group of groups) {
      if (!group.isGroup || !group.children) continue;
      for (const child of group.children) {
        const grandchildren = await this.getChildrenRecursive(child.graphic);
        child.children = grandchildren;
        child.expanded = grandchildren.length > 0;
      }
    }
    return groups;
  }

  private buildNode(graphic: Graphic, isClickedFeature: boolean): HierarchyNode {
    const layer = graphic.layer as FeatureLayer;
    return {
      graphic,
      layerTitle: layer?.title ?? 'Unknown',
      displayLabel: this.buildDisplayLabel(graphic, layer),
      children: undefined,
      expanded: false,
      isClickedFeature,
      isGroup: false,
      childRelationships: this.findChildRelationships(layer),
      loading: false,
    };
  }

  private buildGroupNode(title: string, children: HierarchyNode[]): HierarchyNode {
    return {
      graphic: undefined!,
      layerTitle: '',
      displayLabel: `${title} (${children.length})`,
      children,
      expanded: true,
      isClickedFeature: false,
      isGroup: true,
      childRelationships: [],
      loading: false,
    };
  }

  private async findParent(layer: FeatureLayer, graphic: Graphic): Promise<Graphic | undefined> {
    if (!layer.relationships) return undefined;
    const parentRelationships = layer.relationships.filter((rel) => rel.role === 'destination');

    for (const rel of parentRelationships) {
      const parent = await this.queryParent(layer, graphic, rel);
      if (parent) return parent;
    }

    return undefined;
  }

  private findChildRelationships(layer: FeatureLayer): Relationship[] {
    if (!layer?.relationships) return [];
    return layer.relationships.filter((rel) => rel.role === 'origin');
  }

  private async queryParent(
    layer: FeatureLayer,
    graphic: Graphic,
    relationship: Relationship,
  ): Promise<Graphic | undefined> {
    const objectId = graphic.attributes[layer.objectIdField];

    const query = new RelationshipQuery({
      objectIds: [objectId],
      relationshipId: relationship.id,
      outFields: ['*'],
      returnGeometry: true,
    });

    const result = await layer.queryRelatedFeatures(query);
    const featureSet = result[objectId];
    if (!featureSet?.features?.length) return undefined;

    const parentFeature = featureSet.features[0];
    const relatedLayer = this.findLayerByRelationship(relationship);
    if (relatedLayer) {
      parentFeature.layer = relatedLayer;
    }

    return parentFeature;
  }

  private async queryChildren(layer: FeatureLayer, graphic: Graphic, relationship: Relationship): Promise<Graphic[]> {
    const objectId = graphic.attributes[layer.objectIdField];

    const query = new RelationshipQuery({
      objectIds: [objectId],
      relationshipId: relationship.id,
      outFields: ['*'],
      returnGeometry: true,
    });

    const result = await layer.queryRelatedFeatures(query);
    const featureSet = result[objectId];
    if (!featureSet?.features?.length) return [];

    const relatedLayer = this.findLayerByRelationship(relationship);
    if (relatedLayer) {
      for (const feature of featureSet.features) {
        feature.layer = relatedLayer;
      }
    }

    return featureSet.features;
  }

  private findLayerByRelationship(relationship: Relationship): FeatureLayer | undefined {
    const view = this.viewService.mapView();
    if (!view?.map) return undefined;

    const allLayers = view.map.allLayers;
    return allLayers.find((l) => {
      if (!(l instanceof FeatureLayer)) return false;
      return l.layerId === relationship.relatedTableId;
    }) as FeatureLayer | undefined;
  }

  private buildDisplayLabel(graphic: Graphic, layer: FeatureLayer): string {
    if (!layer?.fields || !graphic.attributes) return 'Feature';

    const displayField = layer.displayField;
    if (displayField && graphic.attributes[displayField] != null) {
      return String(graphic.attributes[displayField]);
    }

    const stringField = layer.fields.find(
      (f) =>
        f.type === 'string' &&
        f.name !== layer.objectIdField &&
        graphic.attributes[f.name] != null &&
        graphic.attributes[f.name] !== '',
    );
    if (stringField) {
      return String(graphic.attributes[stringField.name]);
    }

    return `OID: ${graphic.attributes[layer.objectIdField] ?? 'unknown'}`;
  }
}
