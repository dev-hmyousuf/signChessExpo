import { Permission, Role, ID, Models, Query } from 'appwrite';
import { 
  databases, 
  APPWRITE_DATABASE_ID, 
  getCurrentSession, 
  account
} from './appwrite';

// Collection for admin roles - use the specific collection ID
export const COLLECTION_ADMIN_ROLES = '681ab7a6000725a9fcca'; // Admin roles collection ID

// Enum for admin role types
export enum AdminRoleType {
  ORGANIZER = 'organizer',
  DYNASTY_ADMIN = 'dynasty_admin'
}

// Interface for admin role
export interface AdminRole {
  $id: string;
  userId: string;
  role: AdminRoleType;
  dynastyId?: string; // Only for dynasty admins
}

// Hardcoded admin IDs for fallback
export const HARDCODED_ORGANIZER_IDS = ['681a53f30021a9da4562', '681a4e7c0000eaa7dc45', '681a5e68001f2c26dc10'];

/**
 * Check if a user is an organizer (global admin)
 */
export const isOrganizer = async (userId: string): Promise<boolean> => {
  try {
    // First, check the hardcoded admin IDs as a fallback
    if (HARDCODED_ORGANIZER_IDS.includes(userId)) {
      console.log(`User ${userId} is an organizer based on hardcoded ID list`);
      return true;
    }

    // Next, try to query the database
    try {
      const response = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_ADMIN_ROLES,
        [
          // Query for organizer role
          Query.equal('userId', userId),
          Query.equal('role', AdminRoleType.ORGANIZER)
        ]
      );
      
      const isDbOrganizer = response.documents.length > 0;
      if (isDbOrganizer) {
        console.log(`User ${userId} is an organizer based on database record`);
      } else {
        console.log(`User ${userId} is not an organizer in database records`);
      }
      return isDbOrganizer;
    } catch (dbError) {
      console.error('Error querying admin_roles collection:', dbError);
      console.log('Database query failed, defaulting to hardcoded ID check only');
      return HARDCODED_ORGANIZER_IDS.includes(userId);
    }
  } catch (error) {
    console.error('Error checking if user is organizer:', error);
    return false;
  }
};

/**
 * Check if a user is a dynasty admin
 * @returns Object with isDynastyAdmin and dynastyId
 */
export const isDynastyAdmin = async (userId: string): Promise<{isDynastyAdmin: boolean, dynastyId: string | null}> => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_ADMIN_ROLES,
      [
        // Query for dynasty admin role
        Query.equal('userId', userId),
        Query.equal('role', AdminRoleType.DYNASTY_ADMIN)
      ]
    );
    
    if (response.documents.length > 0) {
      const adminRole = response.documents[0] as unknown as AdminRole;
      return {
        isDynastyAdmin: true,
        dynastyId: adminRole.dynastyId || null
      };
    }
    
    return {
      isDynastyAdmin: false,
      dynastyId: null
    };
  } catch (error) {
    console.error('Error checking if user is dynasty admin:', error);
    return {
      isDynastyAdmin: false,
      dynastyId: null
    };
  }
};

/**
 * Check if the current user has permission to manage a specific dynasty
 */
export const canManageDynasty = async (dynastyId: string): Promise<boolean> => {
  try {
    const session = await getCurrentSession();
    if (!session) return false;
    
    const userData = await account.get();
    const userId = userData.$id;
    
    // Check if user is an organizer (they can manage all dynasties)
    const userIsOrganizer = await isOrganizer(userId);
    if (userIsOrganizer) return true;
    
    // Check if user is a dynasty admin for this specific dynasty
    const { isDynastyAdmin: userIsDynastyAdmin, dynastyId: adminDynastyId } = await isDynastyAdmin(userId);
    return userIsDynastyAdmin && adminDynastyId === dynastyId;
  } catch (error) {
    console.error('Error checking dynasty management permission:', error);
    return false;
  }
};

/**
 * Create document permissions that enforce dynasty-based access control
 * @param ownerId - The user ID who owns the document
 * @param dynastyId - The dynasty ID this document belongs to
 */
export const createDynastyBasedPermissions = (ownerId: string, dynastyId: string) => {
  return [
    // Everyone can read
    Permission.read(Role.any()),
    
    // Document owner can update/delete
    Permission.update(Role.user(ownerId)),
    Permission.delete(Role.user(ownerId)),
    
    // All authenticated users can read
    Permission.read(Role.users()),
    
    // TODO: Add dynasty-based permissions using Appwrite Functions
    // This requires creating a custom function in Appwrite to check
    // if a user is an organizer or has dynasty admin access to this dynasty
  ];
};

/**
 * Check if a user has admin privileges (either organizer or dynasty admin)
 */
export const hasAdminPrivileges = async (userId: string): Promise<boolean> => {
  try {
    // Check if user is an organizer
    const userIsOrganizer = await isOrganizer(userId);
    if (userIsOrganizer) return true;
    
    // Check if user is a dynasty admin
    const { isDynastyAdmin: userIsDynastyAdmin } = await isDynastyAdmin(userId);
    return userIsDynastyAdmin;
  } catch (error) {
    console.error('Error checking admin privileges:', error);
    return false;
  }
};

export default {
  isOrganizer,
  isDynastyAdmin,
  canManageDynasty,
  createDynastyBasedPermissions,
  hasAdminPrivileges,
  COLLECTION_ADMIN_ROLES,
  AdminRoleType
}; 