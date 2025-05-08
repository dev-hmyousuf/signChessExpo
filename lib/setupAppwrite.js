/**
 * INSTRUCTIONS FOR SETTING UP APPWRITE PERMISSIONS
 * 
 * This file contains instructions for setting up your Appwrite database collections
 * with the correct permissions. Follow these steps in the Appwrite console.
 */

/**
 * STEP 1: Create Database and Collections
 * 
 * First, create a database and the following collections:
 * - countries
 * - players
 * - tournaments
 * - matches
 */

/**
 * STEP 2: Set Up Collection Attributes
 * 
 * For each collection, add the required attributes:
 * 
 * COUNTRIES Collection:
 * - name (string, required)
 * - flag (string, required) - country code
 * - playerCount (integer, optional)
 * 
 * PLAYERS Collection:
 * - name (string, required)
 * - countryId (string, required)
 * - userId (string, required) - from Clerk auth
 * - rating (integer, required)
 * - bio (string, optional)
 * - avatar (string, optional)
 * - status (string, required) - "pending" or "approved"
 * - createdAt (string, required) - date string
 * 
 * TOURNAMENTS Collection:
 * - name (string, required)
 * - countryId (string, required)
 * - startDate (string, required)
 * - endDate (string, required)
 * - status (string, required)
 * 
 * MATCHES Collection:
 * - player1Id (string, required)
 * - player2Id (string, required)
 * - tournamentId (string, required)
 * - round (integer, required)
 * - status (string, required)
 * - scheduledDate (string, required)
 * - result (string, optional)
 */

/**
 * STEP 3: Set Collection-Level Permissions
 * 
 * For each collection:
 * 1. Go to the collection settings
 * 2. Navigate to the "Permissions" tab
 * 3. Add these permissions:
 * 
 * COUNTRIES Collection:
 * - Add permission: Role: "any" (guests), Operations: "read"
 * - Add permission: Role: "users", Operations: "read"
 * - Add permission: Role: "team:admins", Operations: "read,create,update,delete"
 * 
 * PLAYERS Collection:
 * - Add permission: Role: "any" (guests), Operations: "read"
 * - Add permission: Role: "users", Operations: "read,create" (allows users to register)
 * - Add permission: Role: "team:admins", Operations: "read,create,update,delete"
 * 
 * TOURNAMENTS Collection:
 * - Add permission: Role: "any" (guests), Operations: "read"
 * - Add permission: Role: "users", Operations: "read"
 * - Add permission: Role: "team:admins", Operations: "read,create,update,delete"
 * 
 * MATCHES Collection:
 * - Add permission: Role: "any" (guests), Operations: "read"
 * - Add permission: Role: "users", Operations: "read"
 * - Add permission: Role: "team:admins", Operations: "read,create,update,delete"
 */

/**
 * STEP 4: Create a Team for Admins
 * 
 * 1. Go to Appwrite Console > Authentication > Teams
 * 2. Create a new team called "admins"
 * 3. Add admin users to this team
 * 4. These users will have full access to manage all collections
 */

/**
 * With these settings, your app will:
 * 1. Allow anonymous users to view tournaments, players, and matches
 * 2. Allow logged-in users to register as players
 * 3. Allow only admin team members to approve player registrations and manage tournaments
 */ 