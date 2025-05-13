# Users Collection Guide

To fix the error, create a 'users' collection in Appwrite with:
- Collection ID: users
- Required attributes: clerkId, name, email, createdAt, lastLoginAt
- Optional attributes: avatarUrl, isPlayer, role, etc.
- Create indexes on clerkId (unique), role, isPlayer

After creating, restart your app.