/**
 * Setup Test Data for Appwrite
 * 
 * This script provides helper functions to setup test data in Appwrite.
 * You can run these functions from your app to create initial test data.
 */

import { 
  createCountry, 
  createDocumentWithPermissions,
  COLLECTION_COUNTRIES, 
  COLLECTION_PLAYERS, 
  COLLECTION_TOURNAMENTS
} from './appwrite';

// Create test countries
export const setupTestCountries = async () => {
  try {
    // Create Bangladesh
    const bangladesh = await createCountry('Bangladesh', 'bd');
    console.log('Created Bangladesh:', bangladesh);
    
    // Create more test countries
    const countries = [
      { name: 'India', flag: 'in' },
      { name: 'Pakistan', flag: 'pk' },
      { name: 'United States', flag: 'us' },
      { name: 'United Kingdom', flag: 'gb' }
    ];
    
    for (const country of countries) {
      await createCountry(country.name, country.flag);
      console.log(`Created country: ${country.name}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error setting up test countries:', error);
    return false;
  }
};

// Create test players (approved)
export const setupTestPlayers = async (countryId) => {
  try {
    const players = [
      { 
        name: 'Mohammad Khan',
        bio: 'Professional player with 10 years experience',
        rating: 1850,
        status: 'approved'
      },
      { 
        name: 'Anika Rahman',
        bio: 'National champion 2022',
        rating: 1920,
        status: 'approved'
      },
      { 
        name: 'Kamal Hossain',
        bio: 'Rising star from Dhaka',
        rating: 1750,
        status: 'approved'
      }
    ];
    
    for (const player of players) {
      await createDocumentWithPermissions(
        COLLECTION_PLAYERS,
        {
          ...player,
          countryId,
          createdAt: new Date().toISOString()
        }
      );
      console.log(`Created player: ${player.name}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error setting up test players:', error);
    return false;
  }
};

// Create a test tournament
export const setupTestTournament = async (countryId) => {
  try {
    const tournament = {
      name: 'National Championship 2023',
      countryId,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      status: 'upcoming'
    };
    
    const result = await createDocumentWithPermissions(
      COLLECTION_TOURNAMENTS,
      tournament
    );
    
    console.log(`Created tournament: ${tournament.name}`);
    return result;
  } catch (error) {
    console.error('Error setting up test tournament:', error);
    return false;
  }
};

// Run the full setup - Note: uncomment to use
// export const setupAllTestData = async () => {
//   const bangladesh = await createCountry('Bangladesh', 'bd');
//   if (bangladesh) {
//     await setupTestPlayers(bangladesh.$id);
//     await setupTestTournament(bangladesh.$id);
//   }
// }; 