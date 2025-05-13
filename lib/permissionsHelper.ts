import { Permission, Role, ID, Models, Query } from 'react-native-appwrite';
import { 
  databases, 
  APPWRITE_DATABASE_ID,
  COLLECTION_USERS
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
  clerkId: string;  // Changed from userId to clerkId
  username: string; // Added username field 
  name: string;     // Full name or display name
  role: AdminRoleType;
  dynastyId?: string; // Only for dynasty admins
}

// Hardcoded admin IDs for fallback
export const HARDCODED_ORGANIZER_IDS = ['681a53f30021a9da4562', '681a4e7c0000eaa7dc45', '681a5e68001f2c26dc10'];

/**
 * Check if a user is an organizer (global admin)
 */
export const isOrganizer = async (clerkUserId: string): Promise<boolean> => {
  try {
    console.log(`Checking if user with clerkId ${clerkUserId} is an organizer`);

    // First check if the user has admin role directly in the users collection
    try {
      const userDocs = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        'users',
        [Query.equal('clerkId', clerkUserId)]
      );
      
      if (userDocs.documents.length > 0) {
        const userDoc = userDocs.documents[0];
        if (userDoc.role === 'organizer') {
          console.log(`User ${clerkUserId} is an organizer based on role in users collection`);
          return true;
        }
      }
    } catch (userError) {
      console.warn('Error checking user document for admin role:', userError);
      // Continue with the admin_roles and hardcoded checks
    }

    // Check for hardcoded admin IDs (transitional approach)
    if (HARDCODED_ORGANIZER_IDS.includes(clerkUserId)) {
      console.log(`User ${clerkUserId} is an organizer based on hardcoded ID list`);
      return true;
    }

    // Check the admin_roles collection with clerkId
    try {
      console.log(`Checking for organizer role using clerkId ${clerkUserId}`);
      const response = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_ADMIN_ROLES,
        [
          // Query for organizer role using clerkId
          Query.equal('clerkId', clerkUserId),
          Query.equal('role', AdminRoleType.ORGANIZER)
        ]
      );
      
      const isDbOrganizer = response.documents.length > 0;
      if (isDbOrganizer) {
        console.log(`User ${clerkUserId} is an organizer based on database record (clerkId match)`);
        return true;
      } else {
        console.log(`User ${clerkUserId} is not an organizer in database records with clerkId`);
      }
    } catch (dbError) {
      console.warn('Error querying admin_roles collection with clerkId:', dbError);
    }
      
    // Try with legacy userId field
    try {
      console.log(`Checking for organizer role using userId ${clerkUserId} (legacy)`);
      const legacyResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_ADMIN_ROLES,
        [
          // Try with legacy userId field
          Query.equal('userId', clerkUserId),
          Query.equal('role', AdminRoleType.ORGANIZER)
        ]
      );
      
      const isLegacyDbOrganizer = legacyResponse.documents.length > 0;
      if (isLegacyDbOrganizer) {
        console.log(`User ${clerkUserId} is an organizer based on database record (userId match)`);
        return true;
      } else {
        console.log(`User ${clerkUserId} is not an organizer in database records with userId`);
      }
    } catch (legacyError) {
      console.warn('Error checking admin_roles with legacy userId:', legacyError);
    }
      
    // Get all admin roles and check each one (fallback for any issues)
    try {
      console.log('Fetching all admin roles as a fallback check');
      const allRolesResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_ADMIN_ROLES
      );
      
      console.log(`Found ${allRolesResponse.documents.length} total admin roles`);
      
      // Check if any role matches this user by either clerkId or userId
      for (const role of allRolesResponse.documents) {
        console.log(`Checking role: ${JSON.stringify(role)}`);
        if (role.role === AdminRoleType.ORGANIZER) {
          if (role.clerkId === clerkUserId || role.userId === clerkUserId) {
            console.log(`Found matching admin role for user ${clerkUserId}`);
            return true;
          }
        }
      }
    } catch (error) {
      console.error('Error in fallback admin role check:', error);
    }
    
    console.log(`User ${clerkUserId} is not an organizer`);
    return false;
  } catch (error) {
    console.error('Error checking if user is organizer:', error);
    return false;
  }
};

/**
 * Check if a user is a dynasty admin
 * @returns Object with isDynastyAdmin and dynastyId
 */
export const isDynastyAdmin = async (clerkUserId: string): Promise<{isDynastyAdmin: boolean, dynastyId: string | null}> => {
  try {
    console.log(`Checking if user with clerkId ${clerkUserId} is a dynasty admin`);
    
    // First check if the user document has a dynasty_admin or admin role directly
    try {
      const userDocs = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        'users', // Using the users collection
        [Query.equal('clerkId', clerkUserId)]
      );
      
      if (userDocs.documents.length > 0) {
        const userDoc = userDocs.documents[0];
        if (userDoc.role === 'dynasty_admin' || userDoc.role === 'organizer') {
          console.log(`User ${clerkUserId} is a dynasty admin based on role in users collection`);
          // If user has the role but no dynastyId is specified yet, assume they can manage
          // the first dynasty they're assigned to
          return {
            isDynastyAdmin: true,
            dynastyId: userDoc.dynastyId || null
          };
        }
      }
    } catch (userError) {
      console.warn('Error checking user document for admin role:', userError);
      // Continue with the admin_roles check
    }
    
    // Check the admin_roles collection with clerkId
    try {
      console.log(`Checking for dynasty admin role using clerkId ${clerkUserId}`);
      const response = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_ADMIN_ROLES,
        [
          // Query for dynasty admin role using clerkId
          Query.equal('clerkId', clerkUserId),
          Query.equal('role', AdminRoleType.DYNASTY_ADMIN)
        ]
      );
      
      if (response.documents.length > 0) {
        const adminRole = response.documents[0] as unknown as AdminRole;
        console.log(`User ${clerkUserId} is a dynasty admin based on database record (clerkId match)`);
        return {
          isDynastyAdmin: true,
          dynastyId: adminRole.dynastyId || null
        };
      }
    } catch (dbError) {
      console.warn('Error querying admin_roles collection with clerkId:', dbError);
    }
    
    // Try legacy userId field for backward compatibility
    try {
      console.log(`Checking for dynasty admin role using userId ${clerkUserId} (legacy)`);
      const legacyResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_ADMIN_ROLES,
        [
          // Try with legacy userId field
          Query.equal('userId', clerkUserId),
          Query.equal('role', AdminRoleType.DYNASTY_ADMIN)
        ]
      );
      
      if (legacyResponse.documents.length > 0) {
        const adminRole = legacyResponse.documents[0] as unknown as AdminRole;
        console.log(`User ${clerkUserId} is a dynasty admin based on database record (userId match)`);
        return {
          isDynastyAdmin: true,
          dynastyId: adminRole.dynastyId || null
        };
      }
    } catch (legacyError) {
      console.warn('Error checking admin_roles with legacy userId:', legacyError);
    }
    
    // Get all admin roles and check each one (fallback for any issues)
    try {
      console.log('Fetching all admin roles as a fallback check for dynasty admin');
      const allRolesResponse = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_ADMIN_ROLES
      );
      
      // Check if any role matches this user by either clerkId or userId
      for (const role of allRolesResponse.documents) {
        if (role.role === AdminRoleType.DYNASTY_ADMIN) {
          if (role.clerkId === clerkUserId || role.userId === clerkUserId) {
            console.log(`Found matching dynasty admin role for user ${clerkUserId}`);
            return {
              isDynastyAdmin: true,
              dynastyId: role.dynastyId || null
            };
          }
        }
      }
    } catch (error) {
      console.error('Error in fallback admin role check for dynasty admin:', error);
    }
    
    console.log(`User ${clerkUserId} is not a dynasty admin`);
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
 * Check if the user has permission to manage a specific dynasty
 * @param dynastyId - The dynasty to check
 * @param clerkUserId - Clerk user ID (required)
 */
export const canManageDynasty = async (dynastyId: string, clerkUserId: string): Promise<boolean> => {
  try {
    if (!clerkUserId) {
      console.error('No clerkUserId provided to canManageDynasty');
      return false;
    }
    
    // Check if user is an organizer (they can manage all dynasties)
    const userIsOrganizer = await isOrganizer(clerkUserId);
    if (userIsOrganizer) return true;
    
    // Check if user is a dynasty admin for this specific dynasty
    const { isDynastyAdmin: userIsDynastyAdmin, dynastyId: adminDynastyId } = await isDynastyAdmin(clerkUserId);
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

/**
 * Add an admin role to a user by username
 * @param username - The username of the user to add the admin role
 * @param role - The type of admin role (organizer or dynasty_admin)
 * @param dynastyId - The dynasty ID (required for dynasty_admin)
 */
export const addAdminRoleByUsername = async (
  username: string, 
  role: AdminRoleType,
  dynastyId?: string
): Promise<{success: boolean, message: string, adminRole?: AdminRole}> => {
  try {
    // Validate inputs
    if (!username) {
      return { success: false, message: 'Username is required' };
    }
    
    if (role === AdminRoleType.DYNASTY_ADMIN && !dynastyId) {
      return { success: false, message: 'Dynasty ID is required for dynasty admin role' };
    }
    
    // Find user by username in the users collection
    const userDocs = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_USERS,
      [Query.equal('username', username)]
    );
    
    if (userDocs.documents.length === 0) {
      return { success: false, message: `User with username '${username}' not found` };
    }
    
    const userDoc = userDocs.documents[0];
    const clerkId = userDoc.clerkId;
    const userName = userDoc.name || username;
    
    if (!clerkId) {
      return { success: false, message: 'User does not have a valid Clerk ID' };
    }
    
    // Check if user already has this role
    const existingRoles = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_ADMIN_ROLES,
      [
        Query.equal('clerkId', clerkId),
        Query.equal('role', role)
      ]
    );
    
    if (role === AdminRoleType.DYNASTY_ADMIN && existingRoles.documents.length > 0) {
      // For dynasty admins, check if they are already admin for this specific dynasty
      const existingDynastyRole = existingRoles.documents.find(
        (doc) => doc.dynastyId === dynastyId
      );
      
      if (existingDynastyRole) {
        return { 
          success: false, 
          message: `User is already a dynasty admin for this dynasty`,
          adminRole: existingDynastyRole as unknown as AdminRole
        };
      }
    } else if (role === AdminRoleType.ORGANIZER && existingRoles.documents.length > 0) {
      // For organizers, they can only have one organizer role
      return { 
        success: false, 
        message: 'User is already an organizer',
        adminRole: existingRoles.documents[0] as unknown as AdminRole
      };
    }
    
    // Create the admin role record
    const adminRoleData: Omit<AdminRole, '$id'> = {
      clerkId,
      username,
      name: userName,
      role,
    };
    
    // Only add dynastyId for dynasty admins
    if (role === AdminRoleType.DYNASTY_ADMIN && dynastyId) {
      adminRoleData.dynastyId = dynastyId;
    }
    
    console.log('Creating admin role with data:', JSON.stringify(adminRoleData, null, 2));
    
    // Create the admin role document
    const newAdminRole = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_ADMIN_ROLES,
      ID.unique(),
      adminRoleData
    );
    
    // Map admin role types to user roles in the users collection
    let userRole = 'user'; // Default role
    if (role === AdminRoleType.ORGANIZER) {
      userRole = 'organizer';
    } else if (role === AdminRoleType.DYNASTY_ADMIN) {
      userRole = 'dynasty_admin';
    }
    
    // Update the user's role in the users collection
    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_USERS,
      userDoc.$id,
      {
        role: userRole,
        ...(role === AdminRoleType.DYNASTY_ADMIN ? { dynastyId: dynastyId } : {})
      }
    );
    
    console.log(`User role updated to ${userRole} for ${username}`);
    
    return { 
      success: true, 
      message: `User '${username}' successfully added as ${role} with role '${userRole}'`,
      adminRole: newAdminRole as unknown as AdminRole
    };
  } catch (error) {
    console.error('Error adding admin role:', error);
    return { 
      success: false, 
      message: `Failed to add admin role: ${(error as any).message || error}`
    };
  }
};

/**
 * Add migration function to convert userId to clerkId
 */
export const migrateUserIdToClerkId = async (): Promise<{success: boolean, migrated: number, message: string}> => {
  try {
    console.log('Starting migration from userId to clerkId in admin_roles collection');
    
    // Get all admin roles
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_ADMIN_ROLES
    );
    
    let migratedCount = 0;
    
    // Process each admin role
    for (const role of response.documents) {
      // Check if it has userId but no clerkId
      if (role.userId && !role.clerkId) {
        console.log(`Migrating role ${role.$id} from userId to clerkId`);
        
        try {
          await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            COLLECTION_ADMIN_ROLES,
            role.$id,
            { 
              clerkId: role.userId,
              // Keep the userId field for backward compatibility
              // but mark it as deprecated in the database
              userId_deprecated: role.userId 
            }
          );
          migratedCount++;
          console.log(`Successfully migrated role ${role.$id}`);
        } catch (updateError) {
          console.error(`Failed to update role ${role.$id}:`, updateError);
        }
      }
    }
    
    console.log(`Migration complete. Migrated ${migratedCount} admin roles.`);
    return {
      success: true,
      migrated: migratedCount,
      message: `Successfully migrated ${migratedCount} admin roles from userId to clerkId`
    };
  } catch (error) {
    console.error('Error during admin roles migration:', error);
    return {
      success: false,
      migrated: 0,
      message: 'Failed to migrate admin roles: ' + (error as Error).message
    };
  }
};

/**
 * Helper function to get all admin roles
 * For admin management interface
 */
export const getAllAdminRoles = async (): Promise<AdminRole[]> => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_ADMIN_ROLES
    );
    
    return response.documents as unknown as AdminRole[];
  } catch (error) {
    console.error('Error fetching admin roles:', error);
    return [];
  }
};

/**
 * Update an existing admin role
 * @param adminRoleId - The ID of the admin role to update
 * @param newRole - The new admin role type
 * @param dynastyId - The dynasty ID (required for dynasty_admin)
 */
export const updateAdminRole = async (
  adminRoleId: string,
  newRole: AdminRoleType,
  dynastyId?: string
): Promise<{success: boolean, message: string}> => {
  try {
    // Validate inputs
    if (!adminRoleId) {
      return { success: false, message: 'Admin role ID is required' };
    }
    
    if (newRole === AdminRoleType.DYNASTY_ADMIN && !dynastyId) {
      return { success: false, message: 'Dynasty ID is required for dynasty admin role' };
    }
    
    // Get the current admin role
    const adminRoleDoc = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_ADMIN_ROLES,
      adminRoleId
    );
    
    if (!adminRoleDoc) {
      return { success: false, message: 'Admin role not found' };
    }
    
    const clerkId = adminRoleDoc.clerkId;
    
    // Find the user in the users collection
    const userDocs = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_USERS,
      [Query.equal('clerkId', clerkId)]
    );
    
    if (userDocs.documents.length === 0) {
      return { success: false, message: 'User not found in the database' };
    }
    
    const userDoc = userDocs.documents[0];
    
    // Determine the new role for the user collection
    let userRole = 'user'; // Default role
    if (newRole === AdminRoleType.ORGANIZER) {
      userRole = 'organizer';
    } else if (newRole === AdminRoleType.DYNASTY_ADMIN) {
      userRole = 'dynasty_admin';
    }
    
    // Update the admin role document
    const updateData: { 
      role: AdminRoleType;
      dynastyId?: string; 
    } = {
      role: newRole
    };
    
    // Only include dynastyId for dynasty admins
    if (newRole === AdminRoleType.DYNASTY_ADMIN && dynastyId) {
      updateData.dynastyId = dynastyId;
    }
    
    // Log the update for debugging
    console.log(`Updating admin role ${adminRoleId} to:`, JSON.stringify(updateData, null, 2));
    
    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_ADMIN_ROLES,
      adminRoleId,
      updateData
    );
    
    // Update the user's role in the users collection
    const userUpdateData: {
      role: string;
      dynastyId?: string;
    } = {
      role: userRole
    };
    
    // Only include dynastyId for dynasty admins
    if (newRole === AdminRoleType.DYNASTY_ADMIN && dynastyId) {
      userUpdateData.dynastyId = dynastyId;
    } else {
      // If changing from dynasty_admin to organizer, we might want to remove dynastyId
      // But we'll leave it for now as it might be useful for history
    }
    
    // Log the user update for debugging
    console.log(`Updating user ${userDoc.$id} to:`, JSON.stringify(userUpdateData, null, 2));
    
    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_USERS,
      userDoc.$id,
      userUpdateData
    );
    
    console.log(`Updated admin role ${adminRoleId} to ${newRole} and user role to ${userRole}`);
    
    return { 
      success: true,
      message: `Admin role successfully updated to ${newRole} and user role updated to ${userRole}`
    };
  } catch (error) {
    console.error('Error updating admin role:', error);
    return { success: false, message: `Failed to update admin role: ${(error as any).message || error}` };
  }
};

/**
 * Delete an admin role and update the user's role accordingly
 * @param adminRoleId - The ID of the admin role to delete
 */
export const deleteAdminRole = async (
  adminRoleId: string
): Promise<{success: boolean, message: string}> => {
  try {
    // Validate input
    if (!adminRoleId) {
      return { success: false, message: 'Admin role ID is required' };
    }
    
    // Get the admin role before deleting
    const adminRoleDoc = await databases.getDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_ADMIN_ROLES,
      adminRoleId
    );
    
    if (!adminRoleDoc) {
      return { success: false, message: 'Admin role not found' };
    }
    
    const clerkId = adminRoleDoc.clerkId;
    
    // Find the user in the users collection
    const userDocs = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_USERS,
      [Query.equal('clerkId', clerkId)]
    );
    
    if (userDocs.documents.length === 0) {
      // Just delete the admin role if no user found
      await databases.deleteDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_ADMIN_ROLES,
        adminRoleId
      );
      return { success: true, message: 'Admin role deleted (no associated user found)' };
    }
    
    const userDoc = userDocs.documents[0];
    
    // Check if the user still has other admin roles
    const otherRoles = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_ADMIN_ROLES,
      [
        Query.equal('clerkId', clerkId),
        Query.notEqual('$id', adminRoleId) // Exclude the current role being deleted
      ]
    );
    
    // If user has other admin roles, determine the highest privilege
    let newUserRole = 'user'; // Default role
    
    if (otherRoles.documents.length > 0) {
      // Check if any of the remaining roles is an organizer
      const hasOrganizer = otherRoles.documents.some(doc => doc.role === AdminRoleType.ORGANIZER);
      if (hasOrganizer) {
        newUserRole = 'organizer';
      } else {
        // If not organizer, but has dynasty_admin, set as dynasty_admin
        newUserRole = 'dynasty_admin';
      }
    } else {
      // No other admin roles, check if the user is a player
      if (userDoc.isPlayer === true) {
        newUserRole = 'player';
      } else {
        newUserRole = 'user';
      }
    }
    
    // Delete the admin role
    await databases.deleteDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_ADMIN_ROLES,
      adminRoleId
    );
    
    // Update the user's role
    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      COLLECTION_USERS,
      userDoc.$id,
      {
        role: newUserRole,
        // If the user is no longer a dynasty admin, we could remove dynastyId
        // but we'll keep it for now as it might be useful for history
      }
    );
    
    console.log(`Deleted admin role ${adminRoleId} and updated user role to ${newUserRole}`);
    
    return { 
      success: true, 
      message: `Admin role deleted and user role updated to ${newUserRole}`
    };
  } catch (error) {
    console.error('Error deleting admin role:', error);
    return { success: false, message: `Failed to delete admin role: ${(error as any).message || error}` };
  }
};

/**
 * Synchronize all user roles based on their admin roles
 * Use this to fix inconsistencies between admin_roles and users collections
 */
export const syncAllUserRoles = async (): Promise<{
  success: boolean, 
  message: string, 
  updated: number,
  errors: number
}> => {
  try {
    console.log('Starting sync of all user roles based on admin roles');
    
    // Get all users
    const allUsers = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      COLLECTION_USERS
    );
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Process each user
    for (const user of allUsers.documents) {
      try {
        const clerkId = user.clerkId;
        if (!clerkId) continue;
        
        // Get all admin roles for this user
        const adminRoles = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          COLLECTION_ADMIN_ROLES,
          [Query.equal('clerkId', clerkId)]
        );
        
        // Determine the correct role based on admin roles
        let correctRole = 'user';
        
        if (adminRoles.documents.length > 0) {
          // Check if any role is organizer (highest privilege)
          const isOrganizer = adminRoles.documents.some(
            doc => doc.role === AdminRoleType.ORGANIZER
          );
          
          if (isOrganizer) {
            correctRole = 'organizer';
          } else {
            // If not organizer but has dynasty_admin, set as dynasty_admin
            const isDynastyAdmin = adminRoles.documents.some(
              doc => doc.role === AdminRoleType.DYNASTY_ADMIN
            );
            
            if (isDynastyAdmin) {
              correctRole = 'dynasty_admin';
            } else if (user.isPlayer === true) {
              correctRole = 'player';
            }
          }
        } else if (user.isPlayer === true) {
          // No admin roles but is a player
          correctRole = 'player';
        }
        
        // Only update if the role is different
        if (user.role !== correctRole) {
          console.log(`Updating user ${user.username || clerkId} role from ${user.role || 'none'} to ${correctRole}`);
          
          await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            COLLECTION_USERS,
            user.$id,
            { role: correctRole }
          );
          
          updatedCount++;
        }
      } catch (userError) {
        console.error(`Error syncing user ${user.$id}:`, userError);
        errorCount++;
      }
    }
    
    return {
      success: true,
      updated: updatedCount,
      errors: errorCount,
      message: `Synchronized ${updatedCount} user roles with ${errorCount} errors`
    };
  } catch (error) {
    console.error('Error syncing all user roles:', error);
    return {
      success: false,
      updated: 0,
      errors: 0,
      message: `Failed to sync user roles: ${(error as any).message || error}`
    };
  }
};

export default {
  isOrganizer,
  isDynastyAdmin,
  canManageDynasty,
  createDynastyBasedPermissions,
  hasAdminPrivileges,
  addAdminRoleByUsername,
  updateAdminRole,
  deleteAdminRole,
  syncAllUserRoles,
  COLLECTION_ADMIN_ROLES,
  AdminRoleType
}; 