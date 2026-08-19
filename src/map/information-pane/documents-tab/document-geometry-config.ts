import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';

export const DOCUMENT_POINT_SYMBOL = new SimpleMarkerSymbol({
  style: 'circle',
  color: [52, 152, 219, 0.8],
  size: 10,
  outline: { color: [255, 255, 255], width: 2 },
});

export const DOCUMENT_POINT_PLACING_SYMBOL = new SimpleMarkerSymbol({
  style: 'diamond',
  color: [46, 204, 113, 0.9],
  size: 12,
  outline: { color: [255, 255, 255], width: 2 },
});
