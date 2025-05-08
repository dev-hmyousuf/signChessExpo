# Deploying Your Image Upload Server

This guide explains how to deploy your image upload server to various hosting platforms.

## Preparation

1. **Configure Environment Variables**:
   - Copy the `.env.example` file to a new file named `.env`
   - Update the `HOST` variable to your actual deployed server URL
   - Example: `HOST=https://your-image-server.vercel.app`

2. **Update React Native App**:
   - Open `app/utils/imageServer.ts` in your React Native app
   - Update the `SERVER_URL` constant to match your deployed server URL
   - Example: `const SERVER_URL = 'https://your-image-server.vercel.app';`

## Deployment Options

### Option 1: Render.com (Recommended)

1. Sign up for an account on [Render](https://render.com)
2. From your dashboard, click "New" and select "Web Service"
3. Connect your GitHub repository or upload your code
4. Configure your service:
   - **Name**: image-upload-server
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Add Environment Variable**: Set `HOST` to your Render URL (you'll get this after deployment)
   - **Create Disk**: Add a persistent disk for the uploads folder (e.g., 1GB)
   - **Mount Path**: `/opt/render/project/src/uploads`
5. Click "Create Web Service"
6. After deployment, go to Settings and get your service URL
7. Update the `HOST` environment variable with this URL

### Option 2: Railway.app

1. Sign up for an account on [Railway](https://railway.app)
2. Create a new project and select "Deploy from GitHub"
3. Configure your service:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - Add environment variables: `HOST`, `PORT`, and `UPLOAD_DIR`
4. Create a volume and mount it at `/app/uploads`
5. Deploy your application
6. Update the `HOST` variable with your Railway service URL

### Option 3: DigitalOcean Droplet

1. Create a Droplet on [DigitalOcean](https://digitalocean.com)
2. SSH into your Droplet
3. Install Node.js and npm
   ```
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
4. Install Git
   ```
   sudo apt-get install git
   ```
5. Clone your repository
   ```
   git clone https://github.com/yourusername/your-repo.git
   cd your-repo/server
   ```
6. Install dependencies
   ```
   npm install
   ```
7. Install PM2 to manage your Node.js process
   ```
   sudo npm install -g pm2
   ```
8. Create and configure your .env file
   ```
   nano .env
   ```
9. Start your server with PM2
   ```
   pm2 start server.js
   pm2 save
   pm2 startup
   ```
10. Set up Nginx as a reverse proxy
   ```
   sudo apt-get install nginx
   sudo nano /etc/nginx/sites-available/default
   ```
11. Configure Nginx
   ```
   server {
     listen 80;
     server_name your-domain.com;
     
     location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```
12. Restart Nginx
   ```
   sudo systemctl restart nginx
   ```
13. Set up SSL with Certbot (recommended)
   ```
   sudo snap install --classic certbot
   sudo certbot --nginx
   ```

### Option 4: Vercel

1. First, create a `vercel.json` file in your server directory with this content:
   ```json
   {
     "version": 2,
     "builds": [
       { "src": "server.js", "use": "@vercel/node" }
     ],
     "routes": [
       { "src": "/(.*)", "dest": "/server.js" }
     ],
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```
2. Sign up for an account on [Vercel](https://vercel.com)
3. Install the Vercel CLI
   ```
   npm install -g vercel
   ```
4. Deploy your project
   ```
   vercel
   ```
5. **Note**: Vercel has ephemeral file storage, so uploaded files will not persist between deployments. For production use, modify the server to store files in a cloud storage service like S3, Google Cloud Storage, or Cloudinary.

## Notes on File Storage

For platforms with ephemeral storage (like Heroku, Vercel, etc.), you'll need to modify the server to use cloud storage:

1. Add cloud storage integration to the server:
   - Amazon S3
   - Google Cloud Storage
   - Firebase Storage
   - Cloudinary (recommended for image handling)

2. Example Cloudinary integration (install `cloudinary` package first):

```javascript
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Replace the file upload logic with:
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path);
    
    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        filename: result.public_id,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: result.secure_url
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
});
```

## After Deployment

1. Test your deployed server by accessing the `/health` endpoint
   ```
   https://your-server-domain.com/health
   ```

2. Update your React Native app to use the deployed server URL
   - Edit `app/utils/imageServer.ts`
   - Set `SERVER_URL` to your deployed URL

3. Rebuild and deploy your React Native app with the updated configuration 