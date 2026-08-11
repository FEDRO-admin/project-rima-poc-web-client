import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import type { CreateTool } from '@arcgis/core/widgets/Sketch/types';

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
      return [{ tool: 'point', label: 'Point', icon: 'pin-plus' }];
    case 'polyline':
      return [
        { tool: 'polyline', label: 'Line', icon: 'line' },
        { tool: 'freehandPolyline', label: 'Freehand', icon: 'freehand' },
      ];
    default:
      return [
        { tool: 'polygon', label: 'Polygon', icon: 'polygon-vertices' },
        { tool: 'rectangle', label: 'Rectangle', icon: 'rectangle' },
        { tool: 'circle', label: 'Circle', icon: 'circle' },
        { tool: 'freehandPolygon', label: 'Freehand', icon: 'freehand' },
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
