import { Account, Client, Databases, ID, Query, Permission, Role, Storage, Functions } from 'appwrite';
import { getMimeType, getFilenameFromUri } from '@/app/utils/fileUtils';
import * as FileSystem from 'expo-file-system';
import { LEGACY_BUCKET_IDS } from '@/app/utils/fileMigration';

// Appwrite configuration values
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = '681a31b6001a23ca785b'; // Go to Appwrite console → Project Settings → Project ID
export const APPWRITE_DATABASE_ID = '681a32370038fa6c72f0'; // Go to Appwrite console → Databases → Your Database → Database ID
const APPWRITE_API_KEY = ''; // For server-side operations (leave empty in client)

// Export project ID for use in other files
export { APPWRITE_PROJECT_ID, APPWRITE_ENDPOINT };

// Storage bucket ID for user avatars and other images
// IMPORTANT: Update this with your actual bucket ID from Appwrite console
export const STORAGE_BUCKET_ID = '681c575d000fd7afbf5a'; // Updated with the correct bucket ID

// Collections
// IMPORTANT: Replace these string values with the actual collection IDs from your Appwrite console
// Find these IDs by clicking on each collection in the Appwrite console
export const COLLECTION_COUNTRIES = '681a327d0034a14ff8bc'; // Replace with the actual Collection ID from Appwrite console
export const COLLECTION_PLAYERS = '681a3287000d8e290f6d'; // Replace with the actual Collection ID from Appwrite console
export const COLLECTION_TOURNAMENTS = '681a328f000e0449ae7e'; // Replace with the actual Collection ID from Appwrite console
export const COLLECTION_MATCHES = '681a3298003694facb41'; // Replace with the actual Collection ID from Appwrite console

// Name change requests collection
export const COLLECTION_NAME_CHANGE_REQUESTS = 'nameChangeRequests'; // Create this collection in Appwrite

// Initialize Appwrite client
const client = new Client();
client
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

// Initialize Appwrite services
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);
export { ID }; // Export ID for account creation

/**
 * Get current authenticated session
 */
export const getCurrentSession = async () => {
  try {
    const session = await account.get();
    console.log('Current session:', session.$id);
    return session;
  } catch (error) {
    console.log('No authenticated session found');
    return null;
  }
};

/**
 * Check if the user is logged in
 */
export const isLoggedIn = async () => {
  try {
    const session = await account.get();
    return session !== null;
  } catch (error) {
    return false;
  }
};

/**
 * Logout the current user
 */
export const logout = async () => {
  try {
    // First check if user is authenticated
    try {
      const session = await account.get();
      if (session) {
        await account.deleteSession('current');
        return true;
      }
    } catch (error) {
      console.log('No active session to logout from');
    }
    return false;
  } catch (error) {
    console.error('Error logging out:', error);
    return false;
  }
};

// Create a new document with appropriate permissions
export const createDocumentWithPermissions = async (
  collectionId: string,
  data: any,
  userId?: string
) => {
  try {
    // Ensure we have a session
    const session = await getCurrentSession();
    if (!session) {
      throw new Error('Authentication required to create documents');
    }
    
    // Define permissions
    const permissions = [
      Permission.read(Role.any()), // Anyone can read
    ];
    
    // If there's a user ID, give that user write permissions
    if (userId) {
      permissions.push(Permission.write(Role.user(userId)));
      permissions.push(Permission.update(Role.user(userId)));
      permissions.push(Permission.delete(Role.user(userId)));
    }
    
    // Add permissions for all authenticated users (similar to "users" role in console)
    permissions.push(Permission.write(Role.users()));
    permissions.push(Permission.update(Role.users()));
    
    // Add the permissions to the data
    const documentData = {
      ...data,
      // Add permissions to allow public read but only owner write
      $permissions: permissions
    };
    
    console.log("Creating document with permissions:", permissions);
    
    return await databases.createDocument(
      APPWRITE_DATABASE_ID,
      collectionId,
      ID.unique(),
      documentData
    );
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
};

// Create a document with dynasty-based permissions
export const createDocumentWithDynastyPermissions = async (
  collectionId: string,
  data: any,
  userId: string,
  dynastyId: string
) => {
  try {
    // Ensure we have a session
    const session = await getCurrentSession();
    if (!session) {
      throw new Error('Authentication required to create documents');
    }
    
    // Define permissions
    const permissions = [
      Permission.read(Role.any()), // Anyone can read
      Permission.write(Role.user(userId)), // Creator can write
      Permission.update(Role.user(userId)), // Creator can update
      Permission.delete(Role.user(userId)), // Creator can delete
    ];
    
    // Add the permissions to the data
    const documentData = {
      ...data,
      dynastyId, // Include the dynasty ID in the document
      // Add permissions
      $permissions: permissions
    };
    
    console.log("Creating document with dynasty permissions for dynasty:", dynastyId);
    
    return await databases.createDocument(
      APPWRITE_DATABASE_ID,
      collectionId,
      ID.unique(),
      documentData
    );
  } catch (error) {
    console.error('Error creating document with dynasty permissions:', error);
    throw error;
  }
};

// Countries
export const getCountries = async () => {
  try {
    console.log("getCountries: Starting to fetch countries from Appwrite");
    console.log("Using APPWRITE_DATABASE_ID:", APPWRITE_DATABASE_ID);
    console.log("Using COLLECTION_COUNTRIES:", COLLECTION_COUNTRIES);
    
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_COUNTRIES,
      [Query.limit(100)]
    );
    
    console.log("getCountries: Countries count:", response.documents.length);
    
    // For each country, fetch the player count
    const countriesWithPlayerCounts = await Promise.all(response.documents.map(async (country) => {
      try {
        // Get players for this country
        const playersResponse = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          COLLECTION_PLAYERS,
          [
            Query.equal('countryId', country.$id),
            Query.limit(1000)
          ]
        );
        
        // Update the player count
        return {
          ...country,
          playerCount: playersResponse.total
        };
      } catch (error) {
        console.error(`Error fetching players for country ${(country as any).name || country.$id}:`, error);
        // Return country with zero player count if there's an error
        return {
          ...country,
          playerCount: 0
        };
      }
    }));
    
    console.log("getCountries: Countries with player counts:", 
      countriesWithPlayerCounts.length > 0 ? 
      (countriesWithPlayerCounts[0] as any).name + ": " + countriesWithPlayerCounts[0].playerCount : 
      "No countries found");
    
    return countriesWithPlayerCounts;
  } catch (error) {
    console.error('Error fetching countries:', error);
    throw error;
  }
};

export const getCountryByName = async (name: string) => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_COUNTRIES,
      [Query.equal('name', name)]
    );
    
    if (response.documents.length === 0) {
      console.log(`Country with name "${name}" not found`);
      return null;
    }
    
    return response.documents[0];
  } catch (error) {
    console.error(`Error fetching country ${name}:`, error);
    throw error;
  }
};

// Create a country
export const createCountry = async (name: string, flag: string) => {
  try {
    const countryData = {
      name,
      flag,
      playerCount: 0
    };
    
    // Use direct document creation without any permissions or dynasty IDs
    return await databases.createDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_COUNTRIES,
      ID.unique(),
      countryData
    );
  } catch (error) {
    console.error('Error creating country:', error);
    throw error;
  }
};

// Players
export const getPlayersByCountry = async (countryId: string) => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_PLAYERS,
      [
        Query.equal('countryId', countryId),
        Query.limit(100)
      ]
    );
    return response.documents;
  } catch (error) {
    console.error(`Error fetching players for country ${countryId}:`, error);
    throw error;
  }
};

export const getPlayerById = async (playerId: string) => {
  try {
    return await databases.getDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_PLAYERS,
      playerId
    );
  } catch (error) {
    console.error(`Error fetching player ${playerId}:`, error);
    throw error;
  }
};

export const getPlayerByUserId = async (userId: string) => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_PLAYERS,
      [Query.equal('userId', userId), Query.limit(1)]
    );
    
    if (response.documents.length === 0) {
      console.log(`No player found with userId "${userId}"`);
      return null;
    }
    
    return response.documents[0];
  } catch (error) {
    console.error(`Error fetching player with userId ${userId}:`, error);
    throw error;
  }
};

// Create a name change request
export const createNameChangeRequest = async (playerId: string, oldName: string, newName: string) => {
  try {
    const requestData = {
      playerId,
      oldName,
      newName,
      status: 'pending', // pending, approved, rejected
      requestedAt: new Date().toISOString(),
      updatedAt: null,
      adminNotes: ''
    };
    
    return await databases.createDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_NAME_CHANGE_REQUESTS,
      ID.unique(),
      requestData
    );
  } catch (error) {
    console.error('Error creating name change request:', error);
    throw error;
  }
};

// Tournaments
export const getTournaments = async () => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_TOURNAMENTS
    );
    return response.documents;
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    throw error;
  }
};

// Matches
export const getMatchesByTournament = async (tournamentId: string) => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_MATCHES,
      [
        Query.equal('tournamentId', tournamentId),
        Query.limit(100)
      ]
    );
    return response.documents;
  } catch (error) {
    console.error(`Error fetching matches for tournament ${tournamentId}:`, error);
    throw error;
  }
};

export const getMatchById = async (matchId: string) => {
  try {
    const match = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_MATCHES,
      matchId
    );
    return match;
  } catch (error) {
    console.error(`Error fetching match ${matchId}:`, error);
    return null;
  }
};

// Create match
export const createMatch = async (match: {
  player1Id: string;
  player2Id: string;
  tournamentId: string;
  round: number;
  status: string;
  scheduledDate?: string;
}) => {
  try {
    return await databases.createDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_MATCHES,
      ID.unique(),
      match
    );
  } catch (error) {
    console.error('Error creating match:', error);
    throw error;
  }
};

// Update match
export const updateMatch = async (matchId: string, data: any) => {
  try {
    return await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_MATCHES,
      matchId,
      data
    );
  } catch (error) {
    console.error(`Error updating match ${matchId}:`, error);
    throw error;
  }
};

// User Profile
export const updateUserProfile = async (userId: string, data: any) => {
  try {
    // Update the player document
    return await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_PLAYERS,
      userId,
      data
    );
  } catch (error) {
    console.error(`Error updating user profile ${userId}:`, error);
    throw error;
  }
};

// Helper function to verify storage bucket configuration
export const verifyStorageBucket = async (): Promise<boolean> => {
  try {
    // Try to list a file from the bucket (we don't need the files, just checking if the bucket is accessible)
    console.log(`Verifying bucket "${STORAGE_BUCKET_ID}" accessibility...`);
    await storage.listFiles(STORAGE_BUCKET_ID, [Query.limit(1)]);
    console.log(`Bucket "${STORAGE_BUCKET_ID}" is accessible!`);
    return true;
  } catch (error: any) {
    // Check error type
    if (error && error.code === 404) {
      console.error(`Bucket "${STORAGE_BUCKET_ID}" does not exist in the project.`);
      console.error('Please create it in the Appwrite console or check the STORAGE_BUCKET_ID value.');
      
      // Show user-friendly alert
      alert('Image upload is not configured correctly. Please contact the administrator.');
    } else {
      console.error(`Error accessing storage bucket: ${error?.message || error}`);
      
      // Show generic error to user
      alert('Unable to access storage. Please check your connection and try again later.');
    }
    return false;
  }
};

// Upload profile image - Browser version
export const uploadProfileImage = async (file: File): Promise<string> => {
  try {
    // Upload the file to storage
    const result = await storage.createFile(
      STORAGE_BUCKET_ID,
      ID.unique(),
      file
    );
    
    // Return the file ID which can be used to construct the file URL
    return result.$id;
  } catch (error) {
    console.error('Error uploading profile image:', error);
    throw error;
  }
};

// Upload profile image from URI - React Native version
export const uploadProfileImageFromUri = async (uri: string): Promise<string> => {
  try {
    console.log(`Starting image upload from URI: ${uri}`);
    
    // First ensure the storage bucket exists
    const bucketExists = await verifyStorageBucket();
    if (!bucketExists) {
      throw new Error(`Storage bucket "${STORAGE_BUCKET_ID}" not found. Please create it in Appwrite console.`);
    }
    
    // Generate a unique file ID
    const fileId = ID.unique();
    
    // Handle invalid URIs
    if (!uri || typeof uri !== 'string') {
      console.error('Invalid URI provided:', uri);
      throw new Error('Invalid image URI');
    }
    
    // Get file name and mime type
    const filename = getFilenameFromUri(uri);
    const mimeType = getMimeType(uri);
    
    console.log(`Processing file: ${filename}, type: ${mimeType}`);
    
    // Method 1: Try using React Native-specific approach
    try {
      console.log('Attempting React Native specific upload...');
      
      // Create file object for React Native
      const file = {
        uri: uri,
        name: filename,
        type: mimeType
      };
      
      // Create FormData and append file
      const formData = new FormData();
      formData.append('file', file as any);
      formData.append('fileId', fileId);
      
      // Upload using the SDK
      const result = await storage.createFile(
        STORAGE_BUCKET_ID,
        fileId,  // Pass fileId directly to SDK
        formData as any
      );
      
      console.log('Upload successful with React Native approach:', result.$id);
      return result.$id;
    } catch (rnError) {
      console.error('React Native approach failed:', rnError);
      
      // Method 2: Try direct XHR approach
      try {
        console.log('Attempting direct XHR upload...');
        
        return new Promise(async (resolve, reject) => {
          // Fetch the image data as blob
          const response = await fetch(uri);
          const blob = await response.blob();
          
          // Create XHR
          const xhr = new XMLHttpRequest();
          
          // Create FormData
          const formData = new FormData();
          
          // Add file to FormData
          formData.append('file', blob, filename);
          formData.append('fileId', fileId);
          
          // Handle response
          xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                console.log('XHR upload successful:', response.$id);
                resolve(response.$id);
              } catch (parseError) {
                reject(new Error('Failed to parse upload response'));
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
            }
          };
          
          // Handle errors
          xhr.onerror = function() {
            reject(new Error('XHR Network error'));
          };
          
          // Set up the request
          xhr.open('POST', `${APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_ID}/files?project=${APPWRITE_PROJECT_ID}`);
          
          // Add required headers
          xhr.setRequestHeader('x-appwrite-project', APPWRITE_PROJECT_ID);
          
          // Send request
          xhr.send(formData);
        });
      } catch (xhrError) {
        console.error('XHR approach failed:', xhrError);
        
        // Method 3: Try fetch API approach
        try {
          console.log('Attempting fetch API upload...');
          
          // Fetch the image data
          const fetchResponse = await fetch(uri);
          const blob = await fetchResponse.blob();
          
          // Create a File object from the blob
          const file = new File([blob], filename, { type: mimeType });
          
          // Create FormData for direct fetch API call
          const formData = new FormData();
          formData.append('file', file);
          formData.append('fileId', fileId);
          
          // Try direct fetch upload first
          try {
            const uploadResponse = await fetch(
              `${APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_ID}/files?project=${APPWRITE_PROJECT_ID}`,
              {
                method: 'POST',
                headers: {
                  'x-appwrite-project': APPWRITE_PROJECT_ID,
                },
                body: formData,
              }
            );
            
            if (!uploadResponse.ok) {
              throw new Error(`Fetch upload failed with status ${uploadResponse.status}`);
            }
            
            const result = await uploadResponse.json();
            console.log('Fetch API upload successful:', result.$id);
            return result.$id;
          } catch (directFetchError) {
            console.error('Direct fetch API failed:', directFetchError);
            
            // Try the SDK with the File object as fallback
            try {
              console.log('Trying SDK with File object...');
              const result = await storage.createFile(
                STORAGE_BUCKET_ID,
                fileId,
                file
              );
              
              console.log('SDK File approach successful:', result.$id);
              return result.$id;
            } catch (sdkError) {
              console.error('SDK File approach failed:', sdkError);
              
              // Method 4: Try Base64 approach
              try {
                console.log('Attempting Base64 upload approach...');
                
                // Read file as base64
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                console.log(`Read file as base64 (length: ${base64.length})`);
                
                // Convert to a blob using fetch API
                const base64Response = await fetch(`data:${mimeType};base64,${base64}`);
                const blob = await base64Response.blob();
                
                // Create formdata
                const formData = new FormData();
                formData.append('file', blob, filename);
                formData.append('fileId', fileId);
                
                // Create headers object
                const headers = {
                  'x-appwrite-project': APPWRITE_PROJECT_ID,
                };
                
                // Upload using fetch
                const response = await fetch(
                  `${APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_ID}/files?project=${APPWRITE_PROJECT_ID}`,
                  {
                    method: 'POST',
                    headers,
                    body: formData,
                  }
                );
                
                if (!response.ok) {
                  throw new Error(`Base64 upload failed with status ${response.status}`);
                }
                
                const result = await response.json();
                console.log('Base64 upload successful:', result.$id);
                return result.$id;
              } catch (base64Error) {
                console.error('Base64 approach failed:', base64Error);
                throw new Error('All upload approaches failed. Cannot upload image.');
              }
            }
          }
        } catch (fetchError) {
          console.error('All approaches failed. Last error:', fetchError);
          throw new Error('Failed to upload image after trying multiple methods');
        }
      }
    }
  } catch (error) {
    console.error('Fatal error in profile image upload:', error);
    throw error;
  }
};

// Get full URL for an uploaded file
export const getFileUrl = (fileId: string): string => {
  return `${APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
};

// Get preview URL (without transformations)
export const getFilePreview = (fileId: string): string => {
  return `${APPWRITE_ENDPOINT}/storage/buckets/${STORAGE_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
};

// Simple, direct file upload for React Native using expo-file-system
export const uploadImageBase64 = async (uri: string): Promise<string> => {
  try {
    // Verify bucket
    const isVerified = await verifyStorageBucket();
    if (!isVerified) {
      throw new Error('Storage bucket is not accessible');
    }
    
    // Generate ID and get file info
    const fileId = ID.unique();
    const filename = getFilenameFromUri(uri);
    const mimeType = getMimeType(uri);
    
    console.log(`Starting base64 upload for ${filename} (${mimeType})`);
    
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    
    // Convert base64 to blob
    const base64Response = await fetch(`data:${mimeType};base64,${base64}`);
    const blob = await base64Response.blob();
    
    // Create a File object from the blob
    const file = new File([blob], filename, { type: mimeType });
    
    // Upload with the SDK
    console.log(`Uploading file (${blob.size} bytes)...`);
    const result = await storage.createFile(
      STORAGE_BUCKET_ID,
      fileId,
      file
    );
    
    console.log(`Upload successful! File ID: ${result.$id}`);
    return result.$id;
  } catch (error) {
    console.error('Error in base64 upload:', error);
    throw error;
  }
};

// Clear functions
export const clearDatabase = async () => {
  try {
    // Get active session for authentication check
    const session = await getCurrentSession();
    if (!session) {
      throw new Error('You must be logged in to clear the database');
    }
    
    console.log('Starting database clearing operation...');
    
    // Clear countries collection
    try {
      console.log('Clearing countries...');
      const countries = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_COUNTRIES,
        [Query.limit(100)]
      );
      
      for (const country of countries.documents) {
        await databases.deleteDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_COUNTRIES,
          country.$id
        );
      }
      console.log(`Deleted ${countries.documents.length} countries`);
    } catch (error) {
      console.error('Error clearing countries:', error);
    }
    
    // Clear players collection
    try {
      console.log('Clearing players...');
      const players = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_PLAYERS,
        [Query.limit(100)]
      );
      
      for (const player of players.documents) {
        await databases.deleteDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_PLAYERS,
          player.$id
        );
      }
      console.log(`Deleted ${players.documents.length} players`);
    } catch (error) {
      console.error('Error clearing players:', error);
    }
    
    // Clear tournaments collection
    try {
      console.log('Clearing tournaments...');
      const tournaments = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_TOURNAMENTS,
        [Query.limit(100)]
      );
      
      for (const tournament of tournaments.documents) {
        await databases.deleteDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_TOURNAMENTS,
          tournament.$id
        );
      }
      console.log(`Deleted ${tournaments.documents.length} tournaments`);
    } catch (error) {
      console.error('Error clearing tournaments:', error);
    }
    
    // Clear matches collection
    try {
      console.log('Clearing matches...');
      const matches = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_MATCHES,
        [Query.limit(100)]
      );
      
      for (const match of matches.documents) {
        await databases.deleteDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_MATCHES,
          match.$id
        );
      }
      console.log(`Deleted ${matches.documents.length} matches`);
    } catch (error) {
      console.error('Error clearing matches:', error);
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
};

export const clearStorage = async () => {
  try {
    // Get active session for authentication check
    const session = await getCurrentSession();
    if (!session) {
      throw new Error('You must be logged in to clear storage');
    }
    
    console.log('Starting storage clearing operation...');
    
    // Function to clear a single bucket
    const clearBucket = async (bucketId: string) => {
      try {
        console.log(`Clearing bucket: ${bucketId}`);
        
        // Get all files from bucket (limit 100 at a time)
        const files = await storage.listFiles(bucketId, [Query.limit(100)]);
        
        // Delete each file
        for (const file of files.files) {
          try {
            await storage.deleteFile(bucketId, file.$id);
          } catch (fileError) {
            console.error(`Error deleting file ${file.$id}:`, fileError);
          }
        }
        
        console.log(`Deleted ${files.files.length} files from bucket ${bucketId}`);
        return files.files.length;
      } catch (error) {
        console.error(`Error clearing bucket ${bucketId}:`, error);
        return 0;
      }
    };
    
    // Clear main bucket
    let mainCount = 0;
    try {
      mainCount = await clearBucket(STORAGE_BUCKET_ID);
    } catch (mainError) {
      console.error('Error clearing main bucket:', mainError);
    }
    
    // Clear legacy buckets
    let legacyCount = 0;
    for (const legacyBucketId of LEGACY_BUCKET_IDS) {
      try {
        legacyCount += await clearBucket(legacyBucketId);
      } catch (legacyError) {
        console.error(`Error clearing legacy bucket ${legacyBucketId}:`, legacyError);
      }
    }
    
    console.log(`Total deleted files: ${mainCount + legacyCount}`);
    return true;
  } catch (error) {
    console.error('Error clearing storage:', error);
    throw error;
  }
};

// Clear local avatar data and cache files
export const clearLocalAvatarData = async () => {
  try {
    console.log('Starting local avatar cleanup...');
    
    // Get the cache directory path
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      console.error('Cache directory not available');
      return false;
    }
    
    // Read the cache directory contents
    const cacheContents = await FileSystem.readDirectoryAsync(cacheDir);
    console.log(`Found ${cacheContents.length} files in cache directory`);
    
    // Filter files that might be avatar-related
    const avatarFiles = cacheContents.filter(filename => 
      filename.includes('temp_file_') || 
      filename.includes('migrated_file_') ||
      filename.includes('ImagePicker') ||
      filename.includes('avatar') ||
      filename.includes('profile')
    );
    
    console.log(`Found ${avatarFiles.length} potential avatar files to delete`);
    
    // Delete each file
    let deletedCount = 0;
    for (const filename of avatarFiles) {
      try {
        const filePath = `${cacheDir}${filename}`;
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        deletedCount++;
      } catch (fileError) {
        console.error(`Error deleting file ${filename}:`, fileError);
      }
    }
    
    console.log(`Successfully deleted ${deletedCount} local avatar files`);
    
    return true;
  } catch (error) {
    console.error('Error clearing local avatar data:', error);
    return false;
  }
};

// Get all countries with detailed logging
export const getAllCountriesWithLogging = async () => {
  try {
    console.log("Getting all countries from database with logging...");
    console.log("Using APPWRITE_DATABASE_ID:", APPWRITE_DATABASE_ID);
    console.log("Using COLLECTION_COUNTRIES:", COLLECTION_COUNTRIES);
    
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_COUNTRIES,
      [Query.limit(100)]
    );
    
    console.log(`Found ${response.documents.length} countries in database:`);
    
    // Log each country
    response.documents.forEach((country, index) => {
      console.log(`${index + 1}. ${country.name} ${country.flag} (ID: ${country.$id})`);
    });
    
    return response.documents;
  } catch (error) {
    console.error('Error fetching countries:', error);
    throw error;
  }
};

// Restore default countries to database
export const restoreDefaultCountries = async (countries: { name: string; flag: string }[]) => {
  try {
    console.log("Starting country restoration process...");
    
    // Check if there are any countries to restore
    if (!countries || countries.length === 0) {
      console.error("No countries provided for restoration");
      return { success: false, message: "No countries provided", count: 0 };
    }
    
    console.log(`Attempting to restore ${countries.length} countries...`);
    
    // Track created countries
    const createdCountries = [];
    
    // Create each country
    for (const country of countries) {
      try {
        // Simply call the createCountry function
        const newCountry = await createCountry(country.name, country.flag);
        
        createdCountries.push(newCountry);
        console.log(`✅ Created country: ${country.name} ${country.flag}`);
      } catch (countryError) {
        console.error(`Error creating country ${country.name}:`, countryError);
      }
    }
    
    console.log(`Successfully restored ${createdCountries.length} out of ${countries.length} countries`);
    
    return {
      success: true,
      message: `Restored ${createdCountries.length} countries`,
      count: createdCountries.length,
      countries: createdCountries
    };
  } catch (error: any) {
    console.error('Error restoring countries:', error);
    return { success: false, message: error.message, count: 0 };
  }
};

export default {
  client,
  account,
  databases,
  storage,
  functions,
  getCurrentSession,
  isLoggedIn,
  logout,
  getCountries,
  getCountryByName,
  getPlayersByCountry,
  getPlayerById,
  getTournaments,
  getMatchesByTournament,
  getMatchById,
  createMatch,
  updateMatch,
  updateUserProfile,
  uploadProfileImage,
  uploadProfileImageFromUri,
  getFilePreview,
  getFileUrl,
  createDocumentWithPermissions,
  createDocumentWithDynastyPermissions,
  uploadImageBase64,
  verifyStorageBucket,
  clearDatabase,
  clearStorage,
  clearLocalAvatarData,
  getAllCountriesWithLogging,
  restoreDefaultCountries
}; 
