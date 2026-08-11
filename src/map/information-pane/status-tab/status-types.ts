export type AttributeValue = string | number | boolean | null;

export interface StatusRecord {
  objectId: number | undefined;
  globalId: string | undefined;
  attributes: Record<string, AttributeValue>;
  isNew: boolean;
  isModified: boolean;
}
