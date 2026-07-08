import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';

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
