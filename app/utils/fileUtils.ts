/**
 * Utility functions for file handling in React Native
 */

/**
 * Get MIME type from a file URI or name
 * @param uri File URI or file name
 * @returns MIME type string
 */
export const getMimeType = (uri: string): string => {
  if (!uri) return 'application/octet-stream';
  
  // Get file extension from URI or file name
  const uriParts = uri.split('.');
  const fileExtension = uriParts[uriParts.length - 1]?.toLowerCase();
  
  // Map common extensions to MIME types
  switch (fileExtension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return 'image/jpeg'; // Default to JPEG for images
  }
};

/**
 * Generate a random filename with extension
 * @param prefix Optional prefix for the filename
 * @param extension File extension (default: jpg)
 * @returns Random filename with timestamp
 */
export const generateRandomFilename = (prefix = 'image', extension = 'jpg'): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}_${timestamp}_${random}.${extension}`;
};

/**
 * Extract filename from URI
 * @param uri File URI
 * @returns Filename or generated random name
 */
export const getFilenameFromUri = (uri: string): string => {
  if (!uri) return generateRandomFilename();
  
  // Try to get filename from URI
  const uriParts = uri.split('/');
  const filename = uriParts[uriParts.length - 1];
  
  // If we couldn't get a proper filename, generate one
  if (!filename || filename.indexOf('.') === -1) {
    return generateRandomFilename();
  }
  
  return filename;
}; 