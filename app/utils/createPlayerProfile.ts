import { account, createDocumentWithPermissions, COLLECTION_PLAYERS } from '@/lib/appwrite';

/**
 * Create a player profile for a verified user
 * This should be called after the user has verified their email
 */
export const createPlayerProfile = async (firstName: string, lastName: string) => {
  try {
    const userAccount = await account.get();
    
    // Create a valid username
    let username = `${firstName.toLowerCase()}${lastName.toLowerCase()}`;
    
    // Truncate if too long
    if (username.length > 30) {
      username = username.substring(0, 30);
    }
    
    // Ensure username only has valid characters (Appwrite restrictions)
    username = username.replace(/[^a-zA-Z0-9._-]/g, '');
    
    // If username starts with special char, prepend 'u'
    if (username.match(/^[._-]/)) {
      username = 'u' + username;
    }
    
    // Create the player document
    const player = await createDocumentWithPermissions(
      COLLECTION_PLAYERS,
      {
        name: `${firstName} ${lastName}`,
        username: username,
        userId: userAccount.$id,
        bio: '',
        status: 'pending',
        rating: 1200,
        countryId: '', // This will need to be set later
        createdAt: new Date().toISOString(),
      },
      userAccount.$id
    );
    
    return player;
  } catch (error) {
    console.error('Error creating player profile:', error);
    throw error;
  }
}; 