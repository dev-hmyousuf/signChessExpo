// Demo data script for Appwrite
import { databases, ID, APPWRITE_DATABASE_ID, COLLECTION_COUNTRIES, COLLECTION_PLAYERS } from '../lib/appwrite';

// Function to add demo countries
const addDemoCountries = async () => {
  console.log("Adding demo countries...");
  
  const countries = [
    { name: "Bangladesh", flag: "🇧🇩" },
    { name: "India", flag: "🇮🇳" },
    { name: "United States", flag: "🇺🇸" },
    { name: "United Kingdom", flag: "🇬🇧" },
    { name: "Australia", flag: "🇦🇺" },
    { name: "Japan", flag: "🇯🇵" },
  ];
  
  const createdCountries = [];
  
  for (const country of countries) {
    try {
      // Create country directly without custom permissions
      const result = await databases.createDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_COUNTRIES,
        ID.unique(),
        {
          name: country.name,
          flag: country.flag,
          playerCount: 0
        }
      );
      console.log(`Created country: ${country.name} with ID: ${result.$id}`);
      createdCountries.push(result);
    } catch (error) {
      // Check if error is because country already exists
      if (error.message && error.message.includes('unique')) {
        console.log(`Country ${country.name} already exists, skipping...`);
      } else {
        console.error(`Error creating country ${country.name}:`, error);
      }
    }
  }
  
  return createdCountries;
};

// Function to add demo players
const addDemoPlayers = async (countries) => {
  console.log("Adding demo players...");
  
  if (!countries || countries.length === 0) {
    // If no countries were passed, fetch them
    try {
      const response = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        COLLECTION_COUNTRIES
      );
      countries = response.documents;
    } catch (error) {
      console.error("Error fetching countries:", error);
      return;
    }
  }
  
  if (!countries || countries.length === 0) {
    console.error("No countries found, cannot add players");
    return;
  }
  
  // Map to store countryId by country name
  const countryMap = {};
  countries.forEach(country => {
    countryMap[country.name] = country.$id;
  });
  
  const players = [
    { name: "Shakib Al Hasan", country: "Bangladesh", rating: 2850, status: "approved" },
    { name: "Tamim Iqbal", country: "Bangladesh", rating: 2750, status: "approved" },
    { name: "Virat Kohli", country: "India", rating: 2900, status: "approved" },
    { name: "Rohit Sharma", country: "India", rating: 2800, status: "approved" },
    { name: "Joe Root", country: "United Kingdom", rating: 2850, status: "approved" },
    { name: "Steve Smith", country: "Australia", rating: 2880, status: "approved" },
    { name: "Kane Williamson", country: "New Zealand", rating: 2830, status: "pending" },
    { name: "Babar Azam", country: "Pakistan", rating: 2800, status: "pending" },
  ];
  
  for (const player of players) {
    const countryId = countryMap[player.country];
    
    if (!countryId) {
      console.log(`Country not found for player ${player.name}, skipping...`);
      continue;
    }
    
    try {
      const result = await databases.createDocument(
        APPWRITE_DATABASE_ID,
        COLLECTION_PLAYERS,
        ID.unique(),
        {
          name: player.name,
          countryId: countryId,
          rating: player.rating,
          status: player.status
        }
      );
      console.log(`Created player: ${player.name} with ID: ${result.$id}`);
    } catch (error) {
      console.error(`Error creating player ${player.name}:`, error);
    }
  }
};

// Main function to run the script
const runDemoDataScript = async () => {
  try {
    console.log("Starting demo data import...");
    const countries = await addDemoCountries();
    await addDemoPlayers(countries);
    console.log("Demo data import completed!");
  } catch (error) {
    console.error("Error importing demo data:", error);
  }
};

// Execute the script
runDemoDataScript(); 