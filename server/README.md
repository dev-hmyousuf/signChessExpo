# Image Upload Server - Railway.com Deployment Ready

A simple image upload server for React Native applications, optimized for deployment on Railway.com. This server provides endpoints for uploading images and returns URLs that can be stored in your Appwrite database.

## Features

- Image upload from form data
- Base64 image upload support
- Automatic file type detection
- Image file validation
- Unique filename generation
- Static file serving
- Ready for Railway.com deployment

## Local Setup

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

## Deploying to Railway.com

1. Create a Railway account at https://railway.app if you don't have one

2. Install the Railway CLI (optional but helpful):
   ```
   npm i -g @railway/cli
   ```

3. Login to Railway (if using the CLI):
   ```
   railway login
   ```

4. Create a new project on Railway:
   - Go to https://railway.app/dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub repository

5. Configure the deployment:
   - In the Railway dashboard, go to your new project
   - Add the following environment variables:
     - `HOST` - Your Railway domain (will be available after first deployment)
     - `NODE_ENV` - Set to "production"
     - `PORT` - Leave as default or set to 3000

6. Create a Railway Volume for persistent storage:
   - Go to "Volumes" in your project
   - Create a new volume with at least 1GB of storage
   - Mount the volume to `/app/uploads` path

7. After the first deployment, update your `HOST` environment variable with your actual Railway URL:
   - Example: `https://your-app-name.railway.app`

8. Update your React Native app to use the Railway URL:
   - In `app/utils/imageServer.ts`, set `SERVER_URL` to your Railway URL

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
    "url": "https://your-app-name.railway.app/uploads/1647852369123-4567890123.jpg"
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
    "url": "https://your-app-name.railway.app/uploads/profile-1647852369123-4567890123.jpg"
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

After deploying to Railway, update the `SERVER_URL` in `app/utils/imageServer.ts`:

```typescript
const SERVER_URL = 'https://your-app-name.railway.app';
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