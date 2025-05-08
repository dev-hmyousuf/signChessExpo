import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { getFilenameFromUri, getMimeType } from '@/app/utils/fileUtils';

// ======================================================================
// SERVER CONFIGURATION
// ======================================================================
// Set your Railway.com deployed server URL here (without trailing slash)
// Examples:
// - Development testing: 'http://192.168.1.5:3000' (local network)
// - Railway deployment: 'https://your-app-name.railway.app'
// ======================================================================

// IMPORTANT: CHANGE THIS VALUE TO YOUR RAILWAY DEPLOYED SERVER URL
const SERVER_URL = 'https://your-app-name.railway.app';

// For local development (uncomment the appropriate line for testing):
// const SERVER_URL = 'http://10.0.2.2:3000';      // Android Emulator
// const SERVER_URL = 'http://localhost:3000';     // iOS Simulator
// const SERVER_URL = 'http://192.168.110.226:3000'; // Local network (use your actual IP)

/**
 * Uploads an image to the backend server from a URI
 * @param uri Local image URI
 * @returns URL of the uploaded image on the server
 */
export const uploadImageToServer = async (uri: string): Promise<string | null> => {
  try {
    console.log(`Starting image upload to server from URI: ${uri}`);
    
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error(`File does not exist at path: ${uri}`);
    }
    
    const filename = getFilenameFromUri(uri);
    const mimeType = getMimeType(uri);
    
    console.log(`File info: ${filename}, ${mimeType}, size: ${fileInfo.size} bytes`);
    
    // Try direct file upload using FormData
    try {
      // Create form data
      const formData = new FormData();
      formData.append('image', {
        uri: uri,
        type: mimeType,
        name: filename,
      } as any);
      
      // Upload to server
      console.log(`Uploading to ${SERVER_URL}/upload`);
      const response = await fetch(`${SERVER_URL}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      // Check result
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Upload failed: ${result.message}`);
      }
      
      console.log(`Upload successful: ${result.file.url}`);
      return result.file.url;
    } catch (uploadError) {
      console.error('Direct upload failed, trying base64 approach:', uploadError);
      
      // Fallback to base64 upload
      return uploadBase64ImageToServer(uri, filename);
    }
  } catch (error) {
    console.error('Error uploading image to server:', error);
    Alert.alert('Upload Error', 'Failed to upload image to server');
    return null;
  }
};

/**
 * Uploads an image to the server using base64 encoding
 * @param uri Local image URI
 * @param filename Optional filename
 * @returns URL of the uploaded image on the server
 */
export const uploadBase64ImageToServer = async (uri: string, filename?: string): Promise<string | null> => {
  try {
    console.log(`Starting base64 image upload to server from URI: ${uri}`);
    
    // Read the file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    if (!base64) {
      throw new Error('Failed to read file as base64');
    }
    
    // Get mime type
    const mimeType = getMimeType(uri);
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    // Upload to server
    console.log(`Uploading base64 image to ${SERVER_URL}/upload/base64`);
    const response = await fetch(`${SERVER_URL}/upload/base64`, {
      method: 'POST',
      body: JSON.stringify({
        image: dataUrl,
        filename: filename || getFilenameFromUri(uri)
      }),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    // Check result
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Base64 upload failed: ${result.message}`);
    }
    
    console.log(`Base64 upload successful: ${result.file.url}`);
    return result.file.url;
  } catch (error) {
    console.error('Error uploading base64 image to server:', error);
    return null;
  }
};

/**
 * Uploads a profile image and returns the server URL
 * This function replaces the Appwrite upload function in your app
 */
export const uploadProfileImage = async (uri: string): Promise<string | null> => {
  try {
    // Try to upload to our custom server
    const imageUrl = await uploadImageToServer(uri);
    
    if (!imageUrl) {
      throw new Error('Failed to get image URL from server');
    }
    
    return imageUrl;
  } catch (error) {
    console.error('Profile image upload failed:', error);
    Alert.alert('Upload Failed', 'Could not upload profile image.');
    return null;
  }
};

/**
 * Check if the server is running and accessible
 * @returns True if server is accessible
 */
export const isServerAvailable = async (): Promise<boolean> => {
  try {
    console.log(`Checking server health at ${SERVER_URL}/health`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${SERVER_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Server health check:', data);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Server health check failed:', error);
    return false;
  }
}; 