import React, { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { databases, APPWRITE_DATABASE_ID, COLLECTION_USERS } from '@/lib/appwrite';
import { Query } from 'react-native-appwrite';
import { ID } from 'react-native-appwrite';

// TypeScript interface for the Appwrite user object
export interface AppwriteUser {
  $id: string;
  clerkId: string;
  name: string;
  username: string;
  email: string;
  avatarUrl?: string;
  isPlayer: boolean;
  createdAt: string;
  lastLoginAt: string;
  role?: string;
  playerRegistrationSubmitted?: boolean;
  playerRegistrationDate?: string;
  playerApprovalDate?: string;
  playerDenialDate?: string;
  playerRegistrationDenied?: boolean;
}

/**
 * Hook to get current user data from both Clerk and the Appwrite database
 * @returns Combined user data from Clerk and Appwrite
 */
export const useCompleteUser = () => {
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const [appwriteUser, setAppwriteUser] = useState<AppwriteUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAppwriteUser = async () => {
      if (isClerkLoaded && isSignedIn && clerkUser) {
        try {
          setError(null);
          console.log('Fetching Appwrite user data for Clerk user:', clerkUser.id);
          
          // Query for the user document with clerkId
          const userDocs = await databases.listDocuments(
            APPWRITE_DATABASE_ID,
            COLLECTION_USERS,
            [Query.equal('clerkId', clerkUser.id)]
          );
          
          if (userDocs.documents.length > 0) {
            const userData = userDocs.documents[0] as unknown as AppwriteUser;
            console.log('Found user in Appwrite database:', userData.$id);
            setAppwriteUser(userData);
            
            // Update last login time
            try {
              await databases.updateDocument(
                APPWRITE_DATABASE_ID,
                COLLECTION_USERS,
                userData.$id,
                { lastLoginAt: new Date().toISOString() }
              );
            } catch (updateError) {
              console.warn('Could not update lastLoginAt time:', updateError);
              // Non-critical error, we can continue
            }
          } else {
            console.log('User document not found in Appwrite database, syncing from Clerk');
            // Automatically sync the user if not found in Appwrite
            const syncedUser = await syncClerkUserToAppwrite(clerkUser);
            if (syncedUser) {
              setAppwriteUser(syncedUser);
              console.log('Successfully created and loaded user data');
            } else {
              console.error('Failed to sync user data from Clerk to Appwrite');
              setError('Failed to create user profile');
            }
          }
        } catch (error: any) {
          console.error('Error fetching user data from Appwrite:', error);
          setError(error?.message || 'Failed to load user data');
        } finally {
          setIsLoading(false);
        }
      } else {
        if (!isClerkLoaded) {
          console.log('Clerk data not yet loaded');
        } else if (!isSignedIn) {
          console.log('User not signed in with Clerk');
        } else if (!clerkUser) {
          console.log('No Clerk user data available');
        }
        setIsLoading(false);
      }
    };

    fetchAppwriteUser();
  }, [isClerkLoaded, isSignedIn, clerkUser]);

  return {
    clerkUser,        // Original Clerk user data
    appwriteUser,     // User data from Appwrite database
    isLoaded: isClerkLoaded && !isLoading,
    isSignedIn,
    error,            // Any error that occurred during the fetch
    
    // Helper methods to easily access common user properties
    getUserId: () => clerkUser?.id,
    getUserName: () => clerkUser?.fullName || clerkUser?.username,
    getUserEmail: () => clerkUser?.primaryEmailAddress?.emailAddress,
    getUserAvatar: () => clerkUser?.imageUrl,
    isPlayer: () => appwriteUser?.isPlayer === true,
    isAdmin: () => appwriteUser?.role === 'admin',
    isDynastyAdmin: () => appwriteUser?.role === 'dynasty_admin',
  };
};

/**
 * Hook to get current user data from Clerk
 * @returns Clerk user data
 */
export const useClerkUser = () => {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  
  return {
    clerkUser,
    isLoaded,
    isSignedIn,
    
    // Helper methods to easily access common user properties
    getUserId: () => clerkUser?.id,
    getUserName: () => clerkUser?.fullName || clerkUser?.username,
    getUserEmail: () => clerkUser?.primaryEmailAddress?.emailAddress,
    getUserAvatar: () => clerkUser?.imageUrl,
  };
};

/**
 * Utility function to sync a Clerk user to the Appwrite database
 * Checks if the user exists by clerkId and creates a new user if they don't
 * @param clerkUser - The Clerk user object to sync
 * @returns The Appwrite user object or null if failed
 */
export const syncClerkUserToAppwrite = async (clerkUser: any) => {
  if (!clerkUser) return null;
  
  try {
    console.log('Syncing Clerk user to database:', clerkUser.id);
    
    // Check if user already exists in database
    const existingUsers = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_USERS,
      [Query.equal('clerkId', clerkUser.id)]
    );
    
    let appwriteUser = null;
    
    if (existingUsers.documents.length > 0) {
      // User exists, update their document
      const existingUser = existingUsers.documents[0] as unknown as AppwriteUser;
      console.log('Updating existing user in database:', existingUser.$id);
      
      // Preserve the existing role
      const existingRole = existingUser.role || 'user';
      
      appwriteUser = await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_USERS,
        existingUser.$id,
        {
          name: clerkUser.fullName || '',
          username: clerkUser.username || existingUser.username || '',
          email: clerkUser.primaryEmailAddress?.emailAddress,
          avatarUrl: clerkUser.imageUrl,
          lastLoginAt: new Date().toISOString(),
          // Keep the existing role value to maintain admin status
          role: existingRole,
        }
      );
      
      console.log(`Updated user while preserving role: ${existingRole}`);
    } else {
      // User doesn't exist, create new document
      console.log('Creating new user in database for Clerk user:', clerkUser.id);
      
      // If no username is set yet, we might need to redirect to a username setup page
      const hasUsername = !!clerkUser.username;
      
      // Create document with read access for everyone but write access only for admins
      const userData = {
        clerkId: clerkUser.id,
        name: clerkUser.fullName || '',
        username: clerkUser?.username || '', // Might be empty for new users
        email: clerkUser.primaryEmailAddress?.emailAddress,
        avatarUrl: clerkUser.imageUrl,
        isPlayer: false, // New users are not players by default
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        role: 'user', // Default role for new users
      };
      
      try {
        appwriteUser = await databases.createDocument(
          APPWRITE_DATABASE_ID,
          COLLECTION_USERS,
          ID.unique(),
          userData
        );
        console.log('Successfully created user document in Appwrite');
      } catch (createError) {
        console.error('Failed to create user document with permissions:', createError);
        // Fallback attempt without explicit permissions
        try {
          appwriteUser = await databases.createDocument(
            APPWRITE_DATABASE_ID,
            COLLECTION_USERS,
            ID.unique(),
            userData
          );
          console.log('Successfully created user document without special permissions');
        } catch (fallbackError) {
          console.error('Failed to create user document using fallback method:', fallbackError);
          throw fallbackError;
        }
      }
    }
    
    console.log('User data successfully synced to database');
    return appwriteUser as unknown as AppwriteUser;
  } catch (error) {
    console.error('Error syncing user data to database:', error);
    return null;
  }
};

/**
 * Hook to check if a user is logged in with Clerk
 * @returns Boolean indicating login status and loading state
 */
export const useIsLoggedIn = () => {
  const { isLoaded, isSignedIn } = useAuth();
  
  return {
    isLoggedIn: isLoaded && isSignedIn,
    isLoading: !isLoaded,
  };
}; 