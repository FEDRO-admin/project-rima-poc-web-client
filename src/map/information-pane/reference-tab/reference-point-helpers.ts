import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { ReferencePoint, AttributeValue } from './reference-point-types';
import { REF_POINT_FK_PARENT_FIELD, REF_POINT_PARENT_CLASS_NAME_FIELD } from './reference-point-config';

export async function applyPointEdits(
  layer: FeatureLayer,
  points: ReferencePoint[],
  deletedObjectIds: number[],
  parentId: string,
  parentLayerName: string,
): Promise<void> {
  if (deletedObjectIds.length > 0) {
    const deleteGraphics = deletedObjectIds.map((oid) => new Graphic({ attributes: { [layer.objectIdField]: oid } }));
    const deleteResult = await layer.applyEdits({ deleteFeatures: deleteGraphics });
    const failedDelete = deleteResult.deleteFeatureResults.find((r: { error?: unknown }) => r.error);
    if (failedDelete?.error) {
      throw failedDelete.error;
    }
  }

  const newPoints = points.filter((p) => p.isNew);
  if (newPoints.length > 0) {
    const addGraphics = newPoints.map((p) => {
      const attributes: Record<string, AttributeValue> = {
        ...p.attributes,
        [REF_POINT_FK_PARENT_FIELD]: parentId,
        [REF_POINT_PARENT_CLASS_NAME_FIELD]: parentLayerName,
      };
      return new Graphic({ attributes, geometry: p.geometry });
    });
    const addResult = await layer.applyEdits({ addFeatures: addGraphics });
    const failedAdd = addResult.addFeatureResults.find((r: { error?: unknown }) => r.error);
    if (failedAdd?.error) {
      throw failedAdd.error;
    }
  }

  const modifiedPoints = points.filter((p) => p.isModified && !p.isNew);
  if (modifiedPoints.length > 0) {
    const updateGraphics = modifiedPoints.map((p) => {
      const attributes = {
        ...p.attributes,
        [layer.objectIdField]: p.objectId,
      } as Record<string, AttributeValue>;
      return new Graphic({ attributes, geometry: p.geometry });
    });
    const updateResult = await layer.applyEdits({ updateFeatures: updateGraphics });
    const failedUpdate = updateResult.updateFeatureResults.find((r: { error?: unknown }) => r.error);
    if (failedUpdate?.error) {
      throw failedUpdate.error;
    }
  }

  layer.refresh();
}
