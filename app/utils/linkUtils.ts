/**
 * Utility functions for handling deep links in the app
 */

/**
 * Creates a deep link URL to a player's profile
 * Can be used for sharing profiles or navigating within the app
 * 
 * @param username The username of the player
 * @param useHttps Whether to use https:// (for web) or signchess:// (for app) scheme
 * @returns A formatted deep link URL
 */
export const createProfileLink = (username: string, useHttps: boolean = false): string => {
  if (!username) return '';
  
  // Remove @ symbol if present at the beginning of username
  const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
  
  // Create the appropriate URL format
  if (useHttps) {
    // Web URL format (for sharing on web)
    return `https://signchess.com/profile/${cleanUsername}`;
  } else {
    // App deep link format (for in-app navigation)
    return `signchess://profile/${cleanUsername}`;
  }
};

/**
 * Parse a profile deep link to extract the username
 * 
 * @param url The deep link URL
 * @returns The username from the URL or null if invalid
 */
export const parseProfileLink = (url: string): string | null => {
  if (!url) return null;
  
  try {
    // Handle both https and custom scheme URLs
    if (url.startsWith('signchess://profile/') || url.includes('signchess.com/profile/')) {
      // Extract username from the URL path
      const urlParts = url.split('/');
      const username = urlParts[urlParts.length - 1];
      
      if (username && username.length > 0) {
        return username;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing profile link:', error);
    return null;
  }
};

/**
 * Open a profile in the app - convenience function for navigation
 * 
 * @param router The expo-router instance
 * @param username The username to navigate to
 */
export const openProfile = (router: any, username: string): void => {
  if (!username) return;
  
  // Remove @ symbol if present at the beginning of username
  const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
  
  // Navigate to the profile route
  router.push(`/profile/${cleanUsername}`);
}; 