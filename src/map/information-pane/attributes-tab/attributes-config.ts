import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import type { CreateTool } from '@arcgis/core/widgets/Sketch/types';
import { ZUSTANDSNOTE_FIELD } from '../../grade/grade-config';
import { RBBS_FIELDS } from '../../rbbs/rbbs-config';

/**
 * Fields hidden from the edit/create panes.
 * Use '*' to hide a field on all layers, or a layer title to scope it.
 */
export const HIDDEN_EDIT_FIELDS: Record<string, readonly string[]> = {
  '*': [...RBBS_FIELDS, ZUSTANDSNOTE_FIELD],
};

export function isHiddenEditField(fieldName: string, layerTitle: string | null | undefined): boolean {
  const globalHidden = HIDDEN_EDIT_FIELDS['*'] ?? [];
  const layerHidden = layerTitle ? (HIDDEN_EDIT_FIELDS[layerTitle] ?? []) : [];
  return globalHidden.includes(fieldName) || layerHidden.includes(fieldName);
}

export const EDIT_POINT_SYMBOL = new SimpleMarkerSymbol({
  color: [0, 121, 193, 0.3],
  outline: { color: [0, 121, 193, 1], width: 2, style: 'dash' },
  size: 12,
});

export const EDIT_LINE_SYMBOL = new SimpleLineSymbol({
  color: [0, 121, 193, 1],
  width: 3,
  style: 'dash',
});

export const EDIT_POLYGON_SYMBOL = new SimpleFillSymbol({
  color: [0, 121, 193, 0.1],
  outline: { color: [0, 121, 193, 1], width: 2, style: 'dash' },
});

export interface DrawingToolOption {
  tool: CreateTool;
  label: string;
  icon: string;
}

export function getDrawingToolsForGeometryType(geometryType: string): DrawingToolOption[] {
  switch (geometryType) {
    case 'point':
    case 'multipoint':
      return [{ tool: 'point', label: 'drawing-tool.point', icon: 'pin-plus' }];
    case 'polyline':
      return [
        { tool: 'polyline', label: 'drawing-tool.line', icon: 'line' },
        { tool: 'freehandPolyline', label: 'drawing-tool.freehand', icon: 'freehand' },
      ];
    default:
      return [
        { tool: 'polygon', label: 'drawing-tool.polygon', icon: 'polygon-vertices' },
        { tool: 'rectangle', label: 'drawing-tool.rectangle', icon: 'rectangle' },
        { tool: 'circle', label: 'drawing-tool.circle', icon: 'circle' },
        { tool: 'freehandPolygon', label: 'drawing-tool.freehand', icon: 'freehand' },
      ];
  }
}

export function getDefaultCreateTool(geometryType: string): CreateTool {
  switch (geometryType) {
    case 'point':
    case 'multipoint':
      return 'point';
    case 'polyline':
      return 'polyline';
    default:
      return 'polygon';
  }
}
