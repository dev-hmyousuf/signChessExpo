# Players Collection Setup Guide

To fix the player registration error ("Collection with the requested ID could not be found"), you need to create the 'players' collection in your Appwrite database:

1. Go to the Appwrite Console: https://cloud.appwrite.io/console
2. Navigate to Databases → Your Database (ID: 681a32370038fa6c72f0)
3. Click "Create Collection"
4. Enter the following information:
   - Collection ID: `681a3287000d8e290f6d` (exactly as shown)
   - Name: "Players"
   - Permissions: Set to match your requirements (recommended: allow public read)

5. After creating the collection, add the following attributes:

### Required Attributes
- `userId` (string, required): Original user ID
- `clerkId` (string, required): Clerk user ID
- `username` (string, required): Clerk username
- `name` (string, required): Player's full display name
- `countryId` (string, required): ID of the country the player represents
- `rating` (integer, required, default: 1200): Player's rating
- `status` (string, required, default: "pending"): Player status (pending, active, etc.)
- `registrationDate` (datetime, required): When the player registered
- `bio` (string, required): Player biography
- `twitterUsername` (string, required, default: ""): Player's Twitter handle

### Optional Attributes
- `avatarUrl` (string): URL to player's avatar
- `isActive` (boolean, default: true): Whether the player is active
- `victories` (integer, default: 0): Number of victories
- `defeats` (integer, default: 0): Number of defeats
- `totalMatches` (integer, default: 0): Total matches played
- `handedness` (string): Player's handedness (left, right, etc.)
- `playingStyle` (string): Player's playing style
- `dateOfBirth` (datetime): Player's date of birth

### Create Indexes
Create the following indexes for efficient queries:
- Index on `userId` (unique)
- Index on `clerkId` (unique)
- Index on `username` (unique)
- Index on `countryId` (non-unique)
- Index on `rating` (non-unique)
- Index on `status` (non-unique)

After setting up the collection and attributes, restart your app for the changes to take effect. 