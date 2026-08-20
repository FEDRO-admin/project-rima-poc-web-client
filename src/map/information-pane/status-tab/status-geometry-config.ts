import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';

export const STATUS_POINT_PLACING_SYMBOL = new SimpleMarkerSymbol({
  style: 'circle',
  color: [52, 152, 219, 0.9],
  size: 12,
  outline: { color: [255, 255, 255], width: 2 },
});
