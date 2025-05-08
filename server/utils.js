const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Generates a secure random filename
 * @param {string} originalName - Original filename
 * @returns {string} Secure filename
 */
function generateSecureFilename(originalName = '') {
  const ext = path.extname(originalName) || '.jpg';
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${randomBytes}${ext}`;
}

/**
 * Gets MIME type from file extension
 * @param {string} filename - Filename with extension
 * @returns {string} MIME type
 */
function getMimeTypeFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Validates that a file is an image
 * @param {string} mimetype - MIME type to validate
 * @returns {boolean} True if file is an image
 */
function isValidImage(mimetype) {
  return mimetype && mimetype.startsWith('image/');
}

/**
 * Ensures upload directory exists
 * @param {string} dir - Directory path
 */
function ensureUploadDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = {
  generateSecureFilename,
  getMimeTypeFromFilename,
  isValidImage,
  ensureUploadDirExists
}; 