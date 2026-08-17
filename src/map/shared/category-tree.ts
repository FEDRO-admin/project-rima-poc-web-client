import GroupLayer from '@arcgis/core/layers/GroupLayer';
import Layer from '@arcgis/core/layers/Layer';
import PortalItem from '@arcgis/core/portal/PortalItem';

export interface CategoryNode {
  name: string;
  children: Map<string, CategoryNode>;
  layers: Layer[];
}

export interface PortalItemEntry {
  item: PortalItem;
  layers: Layer[];
}

export function extractCategorySegments(item: PortalItem, languageCategory: string): string[] {
  const prefix = `/Categories/${languageCategory}`;
  const category = (item.categories ?? []).find((cat) => cat.startsWith(prefix));
  if (!category) return [];

  const remainder = category.slice(prefix.length);
  return remainder.split('/').filter((segment) => segment.length > 0);
}

export function isHiddenCategory(item: PortalItem, hiddenCategory: string): boolean {
  return (item.categories ?? []).some((cat) => cat.split('/').includes(hiddenCategory));
}

export function buildCategoryTree(
  entries: PortalItemEntry[],
  languageCategory: string,
  hiddenCategory: string,
): { rootNode: CategoryNode; rootLayers: Layer[] } {
  const rootNode: CategoryNode = { name: '', children: new Map(), layers: [] };
  const rootLayers: Layer[] = [];

  for (const entry of entries) {
    if (isHiddenCategory(entry.item, hiddenCategory)) {
      entry.layers.forEach((layer) => {
        layer.visible = false;
        layer.listMode = 'hide';
      });
      rootLayers.push(...entry.layers);
      continue;
    }

    const segments = extractCategorySegments(entry.item, languageCategory);
    if (segments.length === 0) {
      rootLayers.push(...entry.layers);
      continue;
    }

    let currentNode = rootNode;
    for (const segment of segments) {
      if (!currentNode.children.has(segment)) {
        currentNode.children.set(segment, { name: segment, children: new Map(), layers: [] });
      }
      currentNode = currentNode.children.get(segment)!;
    }
    currentNode.layers.push(...entry.layers);
  }

  return { rootNode, rootLayers };
}

export function convertTreeToLayers(node: CategoryNode): Layer[] {
  const sortedChildren = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name));

  return sortedChildren.map((child) => {
    const childCategoryLayers = convertTreeToLayers(child);
    const allSublayers = [...childCategoryLayers, ...child.layers]
      .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
      .reverse();
    return new GroupLayer({ title: child.name, layers: allSublayers });
  });
}
