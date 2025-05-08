# Image Upload Server

A simple image upload server for React Native applications. This server provides endpoints for uploading images and returns URLs that can be stored in your Appwrite database.

## Features

- Image upload from form data
- Base64 image upload support
- Automatic file type detection
- Image file validation
- Unique filename generation
- Static file serving

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Configure the server by editing the `.env` file:
   ```
   PORT=3000
   UPLOAD_DIR=uploads
   HOST=http://localhost:3000
   ```

   Note: When testing with a physical device, update the HOST variable to your computer's local IP address:
   ```
   HOST=http://192.168.1.5:3000
   ```

3. Start the server:
   ```
   npm start
   ```

   For development with auto-restart:
   ```
   npm run dev
   ```

## API Endpoints

### Upload Image (multipart/form-data)

**URL:** `POST /upload`

**Parameters:**
- `image`: The image file to upload

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "file": {
    "filename": "1647852369123-4567890123.jpg",
    "originalname": "profile.jpg",
    "mimetype": "image/jpeg",
    "size": 123456,
    "url": "http://localhost:3000/uploads/1647852369123-4567890123.jpg"
  }
}
```

### Upload Base64 Image

**URL:** `POST /upload/base64`

**Parameters:**
- `image`: Base64 image data (with MIME type prefix)
- `filename`: Optional original filename

**Example Request Body:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
  "filename": "profile.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Base64 image uploaded successfully",
  "file": {
    "filename": "profile-1647852369123-4567890123.jpg",
    "mimetype": "image/jpeg",
    "size": 123456,
    "url": "http://localhost:3000/uploads/profile-1647852369123-4567890123.jpg"
  }
}
```

### Health Check

**URL:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running",
  "timestamp": "2023-07-01T12:34:56.789Z"
}
```

## Integration with React Native App

Update the `SERVER_URL` in `app/utils/imageServer.ts` to point to your server:

```typescript
const SERVER_URL = 'http://192.168.1.5:3000'; // Your computer's local IP address
```

Then use the provided functions to upload images:

```typescript
import { uploadProfileImage } from '@/app/utils/imageServer';

// In your component
const handleImageUpload = async (imageUri) => {
  const imageUrl = await uploadProfileImage(imageUri);
  if (imageUrl) {
    // Store imageUrl in Appwrite database
    await updateUserProfile(userId, {
      avatar: imageUrl
    });
  }
};
``` 