const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const os = require('os');

// Load environment variables
dotenv.config();

// Get local IP address for server
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1'; // Fallback to localhost
}

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const localIp = getLocalIpAddress();
const HOST = process.env.HOST || `http://${localIp}:${PORT}`;

// Log server configuration
console.log('Server configuration:');
console.log(`- Local IP: ${localIp}`);
console.log(`- HOST URL: ${HOST}`);
console.log(`- Port: ${PORT}`);

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function(req, file, cb) {
    // Generate a unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(UPLOAD_DIR));

// Root route - displays welcome page with API info
app.get('/', (req, res) => {
  const uploadedFiles = fs.existsSync(UPLOAD_DIR) ? 
    fs.readdirSync(UPLOAD_DIR).filter(file => !file.startsWith('.')).length : 0;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Image Upload Server</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
          color: #333;
        }
        h1, h2 {
          color: #0066cc;
        }
        pre {
          background-color: #f5f5f5;
          padding: 10px;
          border-radius: 5px;
          overflow-x: auto;
        }
        .endpoint {
          margin-bottom: 30px;
          border-bottom: 1px solid #eee;
          padding-bottom: 20px;
        }
        .server-info {
          background-color: #e9f7fe;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .network-info {
          background-color: #f8f4e5;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <h1>Image Upload Server</h1>
      
      <div class="server-info">
        <p><strong>Server Status:</strong> Running</p>
        <p><strong>Host:</strong> ${HOST}</p>
        <p><strong>Upload Directory:</strong> ${path.resolve(UPLOAD_DIR)}</p>
        <p><strong>Files Stored:</strong> ${uploadedFiles} files</p>
      </div>
      
      <div class="network-info">
        <h3>Access from other devices:</h3>
        <p>Your server is accessible on the local network at:</p>
        <p><strong>URL:</strong> ${HOST}</p>
        <p>Use this URL in your React Native app's configuration.</p>
      </div>
      
      <h2>API Endpoints</h2>
      
      <div class="endpoint">
        <h3>1. Upload Image (multipart/form-data)</h3>
        <p><strong>URL:</strong> POST ${HOST}/upload</p>
        <p><strong>Parameters:</strong> 'image' file field</p>
        <p><strong>Description:</strong> Upload an image file using form data</p>
        <pre>
// Example Response
{
  "success": true,
  "message": "File uploaded successfully",
  "file": {
    "filename": "1647852369123-4567890123.jpg",
    "originalname": "profile.jpg",
    "mimetype": "image/jpeg",
    "size": 123456,
    "url": "${HOST}/uploads/1647852369123-4567890123.jpg"
  }
}</pre>
      </div>
      
      <div class="endpoint">
        <h3>2. Upload Base64 Image</h3>
        <p><strong>URL:</strong> POST ${HOST}/upload/base64</p>
        <p><strong>Parameters:</strong> JSON body with 'image' (base64 string) and optional 'filename'</p>
        <p><strong>Description:</strong> Upload an image as base64 encoded data</p>
        <pre>
// Example Request
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
  "filename": "profile.jpg"
}

// Example Response
{
  "success": true,
  "message": "Base64 image uploaded successfully",
  "file": {
    "filename": "profile-1647852369123-4567890123.jpg",
    "mimetype": "image/jpeg",
    "size": 123456,
    "url": "${HOST}/uploads/profile-1647852369123-4567890123.jpg"
  }
}</pre>
      </div>
      
      <div class="endpoint">
        <h3>3. Health Check</h3>
        <p><strong>URL:</strong> GET ${HOST}/health</p>
        <p><strong>Description:</strong> Check if the server is running</p>
        <pre>
// Example Response
{
  "status": "ok",
  "message": "Server is running",
  "timestamp": "2023-07-01T12:34:56.789Z"
}</pre>
      </div>
      
      <p>For more information, please refer to the documentation.</p>
    </body>
    </html>
  `);
});

// Upload route
app.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    // Construct the file URL
    const fileUrl = `${HOST}/uploads/${req.file.filename}`;
    
    console.log(`File uploaded: ${req.file.filename}`);
    console.log(`File accessible at: ${fileUrl}`);
    
    // Return success response with file details
    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl
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

// Upload route for base64 images
app.post('/upload/base64', (req, res) => {
  try {
    const { image, filename } = req.body;
    
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided'
      });
    }
    
    // Extract base64 data and file type
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Invalid base64 image format'
      });
    }
    
    // Get mime type and base64 data
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check if it's an image
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed'
      });
    }
    
    // Generate filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = mimeType.split('/')[1];
    const outputFilename = filename 
      ? `${filename.replace(/\.[^/.]+$/, '')}-${uniqueSuffix}.${ext}`
      : `image-${uniqueSuffix}.${ext}`;
    
    // File path
    const filePath = path.join(UPLOAD_DIR, outputFilename);
    
    // Save file
    fs.writeFileSync(filePath, buffer);
    
    // Construct the file URL
    const fileUrl = `${HOST}/uploads/${outputFilename}`;
    
    console.log(`Base64 image saved as: ${outputFilename}`);
    console.log(`File accessible at: ${fileUrl}`);
    
    return res.status(200).json({
      success: true,
      message: 'Base64 image uploaded successfully',
      file: {
        filename: outputFilename,
        mimetype: mimeType,
        size: buffer.length,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('Base64 upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error uploading base64 image',
      error: error.message
    });
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Start server - listen on all interfaces (0.0.0.0) to allow external access
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on ${HOST}`);
  console.log(`Local IP address: ${localIp}`);
  console.log(`Server accessible at: http://${localIp}:${PORT}`);
  console.log(`Upload directory: ${path.resolve(UPLOAD_DIR)}`);
});
