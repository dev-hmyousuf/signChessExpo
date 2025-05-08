// Appwrite Cloud Function: lookupUserByEmail
// This function searches for a user by email and returns their information
// Deploy this in your Appwrite console under 'Functions'

const sdk = require('node-appwrite');

/*
  'req' variable has:
    'headers' - object with request headers
    'payload' - request body data as a string
    'variables' - object with function variables

  'res' variable has:
    'send(text, status)' - function to return text response. Status code defaults to 200
    'json(obj, status)' - function to return JSON response. Status code defaults to 200
  
  If an error is thrown, a response with code 500 will be returned.
*/

module.exports = async function(req, res) {
  // Initialize the Appwrite SDK
  const client = new sdk.Client();
  
  // Make sure to set your platform project ID and API Key
  if (
    !req.variables['APPWRITE_FUNCTION_PROJECT_ID'] || 
    !req.variables['APPWRITE_API_KEY']
  ) {
    return res.json({ error: 'Environment variables are not set' }, 500);
  }
  
  client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(req.variables['APPWRITE_FUNCTION_PROJECT_ID'])
    .setKey(req.variables['APPWRITE_API_KEY']);
  
  // Initialize Appwrite services
  const users = new sdk.Users(client);
  
  try {
    const payload = JSON.parse(req.payload || '{}');
    const email = payload.email;
    
    // Validate email
    if (!email) {
      return res.json({ error: 'Email is required' }, 400);
    }
    
    // Try to find the user by email
    // Note: In Appwrite, there's no direct "find by email" function
    // So we need to list users and filter on the server side
    const usersList = await users.list([
      sdk.Query.equal('email', email),
      sdk.Query.limit(1)
    ]);
    
    // Check if user was found
    if (usersList.total === 0) {
      return res.json({ error: 'User not found' }, 404);
    }
    
    // Get the first user that matches the email
    const user = usersList.users[0];
    
    // Return user data (limited for security)
    return res.json({
      $id: user.$id,
      name: user.name,
      email: user.email
    });
    
  } catch (error) {
    console.error('Function error:', error);
    return res.json({ error: error.message }, 500);
  }
}; 