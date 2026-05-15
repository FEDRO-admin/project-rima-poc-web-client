export interface LayerTreeGroup {
  id: number;
  name: string;
  type: 'group';
  visible: boolean;
  children: LayerTreeNode[];
}

export interface LayerTreeLeaf {
  id: number;
  name: string;
  type: 'feature';
  visible: boolean;
  geometryType: string;
  hasFeatureServer: boolean;
}

export type LayerTreeNode = LayerTreeGroup | LayerTreeLeaf;

export function isGroupNode(node: LayerTreeNode): node is LayerTreeGroup {
  return node.type === 'group';
}

export function isLeafNode(node: LayerTreeNode): node is LayerTreeLeaf {
  return node.type === 'feature';
}

export function findLeaf(tree: LayerTreeNode[], id: number): LayerTreeLeaf | undefined {
  for (const node of tree) {
    if (isLeafNode(node) && node.id === id) return node;
    if (isGroupNode(node)) {
      const found = findLeaf(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}
