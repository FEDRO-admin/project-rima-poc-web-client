import Graphic from '@arcgis/core/Graphic';

export function buildFeatureDisplayLabel(graphic: Graphic): string {
  const attrs = graphic.attributes;
  if (!attrs) return 'Feature';
  return attrs.name ?? attrs.id ?? attrs.objectid ?? firstNonNullValue(attrs) ?? 'Feature';
}

export function buildFeatureListLabel(graphic: Graphic): string {
  const attrs = graphic.attributes;
  if (!attrs) return 'Feature';
  return attrs.OBJECTID ?? attrs.FID ?? attrs.ID ?? firstNonNullValue(attrs) ?? 'Feature';
}

function firstNonNullValue(attrs: Record<string, unknown>): string | undefined {
  const value = Object.values(attrs).find((v) => v != null);
  return value != null ? String(value) : undefined;
}
