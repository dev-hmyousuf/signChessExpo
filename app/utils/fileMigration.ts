import { 
  storage, 
  ID, 
  STORAGE_BUCKET_ID,
  uploadImageBase64,
  APPWRITE_PROJECT_ID,
  APPWRITE_ENDPOINT
} from '@/lib/appwrite';

import * as FileSystem from 'expo-file-system';

/**
 * Legacy bucket IDs that might contain files
 */
export const LEGACY_BUCKET_IDS = [
  '681c49190002bfa1a9db', // Old bucket ID
  '681c4ed100071fc64cbf', // Previous bucket ID
];

/**
 * Attempts to download a file from any bucket (current or legacy)
 * and returns the file as a base64 string
 * 
 * @param fileId File ID to download
 * @param bucketIds Array of bucket IDs to try
 * @returns Base64 string of the file or null if not found
 */
export const downloadFileFromAnyBucket = async (
  fileId: string, 
  bucketIds: string[] = [STORAGE_BUCKET_ID, ...LEGACY_BUCKET_IDS]
): Promise<string | null> => {
  // Try to download from each bucket
  for (const bucketId of bucketIds) {
    try {
      console.log(`Attempting to download file ${fileId} from bucket ${bucketId}...`);
      
      // Get direct file view URL (no transformations)
      const viewUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
      
      // Check if the file is accessible first with HEAD request
      try {
        const headResponse = await fetch(viewUrl, { method: 'HEAD' });
        if (!headResponse.ok) {
          console.log(`File not accessible in bucket ${bucketId} (status: ${headResponse.status})`);
          continue;
        }
      } catch (headError) {
        console.log(`HEAD request failed for bucket ${bucketId}:`, headError);
        continue;
      }
      
      // If accessible, download the file
      try {
        const { uri: tempUri } = await FileSystem.downloadAsync(
          viewUrl,
          FileSystem.cacheDirectory + `temp_file_${fileId}`
        );
        
        // Convert to base64
        const base64 = await FileSystem.readAsStringAsync(tempUri, { encoding: 'base64' });
        console.log(`Successfully downloaded file (${base64.length} bytes) from bucket ${bucketId}`);
        
        // Clean up temp file
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
        
        return base64;
      } catch (downloadError) {
        console.log(`Download failed from bucket ${bucketId}:`, downloadError);
      }
    } catch (error) {
      console.log(`Failed to download from bucket ${bucketId}:`, error);
    }
  }
  
  console.error(`File ${fileId} not found in any bucket`);
  return null;
};

/**
 * Migrates a file from any bucket to the current bucket
 * 
 * @param fileId File ID to migrate
 * @param targetBucketId Target bucket ID (defaults to current bucket)
 * @returns New file ID if migration successful, null otherwise
 */
export const migrateFile = async (
  fileId: string,
  targetBucketId: string = STORAGE_BUCKET_ID
): Promise<string | null> => {
  try {
    console.log(`Attempting to migrate file ${fileId} to bucket ${targetBucketId}...`);
    
    // Download file from any bucket
    const base64 = await downloadFileFromAnyBucket(fileId);
    if (!base64) {
      throw new Error(`Could not download file ${fileId} from any bucket`);
    }
    
    // Create a temp file
    const tempUri = FileSystem.cacheDirectory + `migrated_file_${fileId}`;
    await FileSystem.writeAsStringAsync(tempUri, base64, { encoding: 'base64' });
    
    // Upload to new bucket
    const newFileId = await uploadImageBase64(tempUri);
    
    // Clean up
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
    
    console.log(`Successfully migrated file ${fileId} to ${newFileId}`);
    return newFileId;
  } catch (error) {
    console.error(`Error migrating file ${fileId}:`, error);
    return null;
  }
}; 