/** Portal folder name where uploaded documents are stored. */
export const DOCUMENTS_PORTAL_FOLDER = 'rima-documents';

/** Name of the document featureclass / related table. */
export const DOCUMENTS_TABLE_NAME = 'r_object_document';

/** Document types that can be viewed directly in the browser. */
export const DOCUMENTS_VIEWABLE_TYPES = ['PDF', 'Bild'];

/** Maximum allowed file size for upload (in megabytes). */
export const DOCUMENTS_MAX_FILE_SIZE_MB = 50;

/**
 * Base URL for the document REST API.
 * Currently unused — documents are uploaded to the ESRI Portal.
 * Set this when the custom backend is ready.
 */
export const DOCUMENTS_API_BASE_URL = '';
