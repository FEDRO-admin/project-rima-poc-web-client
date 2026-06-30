import type { CreateTool } from '@arcgis/core/widgets/Sketch/types';

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

export function getGeometryTypeLabel(geometryType: string): string {
  switch (geometryType) {
    case 'point':
    case 'multipoint':
      return 'Point';
    case 'polyline':
      return 'Line';
    default:
      return 'Polygon';
  }
}
