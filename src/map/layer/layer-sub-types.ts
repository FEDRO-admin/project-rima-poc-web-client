import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

export interface SubtypeEntry {
  code: string | number;
  name: string;
}

export function getSubtypeFieldName(layer: FeatureLayer): string | undefined {
  return layer.subtypeField || (layer.sourceJSON?.['subtypeFieldName'] as string | undefined) || undefined;
}

export function getSubtypes(layer: FeatureLayer): SubtypeEntry[] {
  if (layer.subtypes?.length) {
    return layer.subtypes.map((subtype) => ({ code: subtype.code, name: subtype.name }));
  }
  const sourceSubtypes = layer.sourceJSON?.['subtypes'] as SubtypeEntry[] | undefined;
  return sourceSubtypes ?? [];
}

export function getDefaultSubtypeCode(layer: FeatureLayer): number | string | undefined {
  return layer.sourceJSON?.['defaultSubtypeCode'] as number | string | undefined;
}
