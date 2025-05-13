<p align="center">
  <a href="https://clerk.com?utm_source=github&utm_medium=clerk_docs" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/images/light-logo.png">
      <img alt="Clerk Logo for light background" src="./assets/images/dark-logo.png" height="64">
    </picture>
  </a>
  <br />
</p>
<div align="center">
  <h1>
    Clerk and Expo Quickstart
  </h1>
  <a href="https://www.npmjs.com/package/@clerk/clerk-js">
    <img alt="Downloads" src="https://img.shields.io/npm/dm/@clerk/clerk-js" />
  </a>
  <a href="https://discord.com/invite/b5rXHjAg7A">
    <img alt="Discord" src="https://img.shields.io/discord/856971667393609759?color=7389D8&label&logo=discord&logoColor=ffffff" />
  </a>
  <a href="https://twitter.com/clerkdev">
    <img alt="Twitter" src="https://img.shields.io/twitter/url.svg?label=%40clerkdev&style=social&url=https%3A%2F%2Ftwitter.com%2Fclerkdev" />
  </a>
  <br />
  <br />
  <img alt="Clerk Hero Image" src="./assets/images/hero.png">
</div>

## Introduction

Clerk is a developer-first authentication and user management solution. It provides pre-built React components and hooks for sign-in, sign-up, user profile, and organization management. Clerk is designed to be easy to use and customize, and can be dropped into any React or Next.js application.

After following the quickstart you'll have learned how to:

- Install `@clerk/clerk-expo`
- Setup your environment key
- Wrap your Expo app in `<ClerkProvider />` and supply your `tokenCache`
- Conditionally show content based on your auth state
- Build your sign-in and sign-up pages

### Branches of this repository

- `main`: The result of following the [Clerk Expo quickstart](https://clerk.com/docs/quickstarts/expo).
- `advanced`: A more advanced version of the quickstart, with OAuth connections, error handling and styling.

## Running the template

```bash
git clone https://github.com/clerk/clerk-expo-quickstart
```

To run the example locally, you'll need to make sure you have XCode installed and configured properly, then:

1. Sign up for a Clerk account at [https://clerk.com](https://dashboard.clerk.com/sign-up?utm_source=DevRel&utm_medium=docs&utm_campaign=templates&utm_content=10-24-2023&utm_term=clerk-expo-quickstart).

2. Go to the [Clerk dashboard](https://dashboard.clerk.com?utm_source=DevRel&utm_medium=docs&utm_campaign=templates&utm_content=10-24-2023&utm_term=clerk-expo-quickstart) and create an application.

3. Set the required Clerk environment variable as shown in [the example `env` file](./.env.example).

4. `npm install` the required dependencies.

5. `npm run start` to launch the development server.

## Learn more

To learn more about Clerk and Expo, check out the following resources:

- [Quickstart: Get started with Expo and Clerk](https://clerk.com/docs/quickstarts/expo?utm_source=DevRel&utm_medium=docs&utm_campaign=templates&utm_content=10-24-2023&utm_term=clerk-expo-quickstart)

- [Clerk Documentation](https://clerk.com/docs/references/expo/overview?utm_source=DevRel&utm_medium=docs&utm_campaign=templates&utm_content=10-24-2023&utm_term=clerk-expo-quickstart)

- [Expo Documentation](https://docs.expo.dev/)

## Found an issue or want to leave feedback

Feel free to create a support thread on our [Discord](https://clerk.com/discord). Our support team will be happy to assist you in the `#support` channel.

## Connect with us

You can discuss ideas, ask questions, and meet others from the community in our [Discord](https://discord.com/invite/b5rXHjAg7A).

If you prefer, you can also find support through our [Twitter](https://twitter.com/ClerkDev), or you can [email](mailto:support@clerk.dev) us!

# React Native App with Appwrite Authentication

A React Native mobile application with Appwrite for backend services and authentication.

## Email OTP Authentication

This app implements email OTP (One-Time Password) authentication using Appwrite's Email Token API. This provides a secure and user-friendly way to authenticate users without requiring them to remember passwords.

### How It Works

1. **Sending the OTP**:
   - When a user signs up or requests verification, the app generates a unique ID and calls Appwrite's `createEmailToken` method.
   - This sends an email to the user containing a 6-digit verification code.
   - The app also displays a security phrase, which is included in the email to protect against phishing.

2. **Verifying the OTP**:
   - The user enters the 6-digit code they received.
   - The app calls Appwrite's `createSession` method with the user ID and the code.
   - If verified, a session is created and the user is logged in.

### Security Features

- **Security Phrase**: A random phrase shown on-screen and in the email helps users verify the authenticity of the email.
- **Limited Validity**: The OTP codes expire after a short period for security.
- **No Password Storage**: Since authentication happens via email, there are no passwords to store or manage.

### Example Usage

```javascript
// Send OTP code to user's email
const sessionToken = await account.createEmailToken(
  ID.unique(),
  'user@example.com',
  true // Enable security phrase
);

// Store the userId for verification later
const userId = sessionToken.userId;

// When user enters the code
const session = await account.createSession(userId, otpCode);
```

## Theme Guidelines

This app uses a consistent orange-based theme inspired by the Sign logo.

### Color Palette

The application uses a standardized color palette defined in `app/utils/theme.ts`:

```js
// Primary colors from the Sign logo
primary: '#FF6B00', // Bright orange (main color)
primaryLight: '#FF8C3D', // Lighter orange
primaryDark: '#E05A00', // Darker orange

// Secondary and accent colors
secondary: '#FFE0CC', // Very light orange
accent: '#FFA366', // Soft orange

// Functional colors
success: '#4CAF50', // Green
danger: '#F44336', // Red
warning: '#FFC107', // Amber
info: '#FF6B00', // Same as primary
```

### Design Guidelines

1. **Buttons** 
   - Primary actions: Use the primary orange color
   - Secondary actions: White with orange text
   - Danger actions: Red color

2. **Forms**
   - Input fields: Light background with subtle borders
   - Active states: Orange highlights
   - Error states: Red highlights

3. **Typography**
   - Headings: Dark text, heavier weight
   - Body text: Medium gray for readability
   - Links/interactive elements: Orange color

4. **Cards & Containers**
   - White background with subtle shadows
   - Border radius: 8-16px for most elements
   - Light orange backgrounds for highlight sections

## Styling Components

Always import the theme constants:

```js
import { THEME, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@/app/utils/theme';
```

Example styling:

```js
const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  heading: {
    ...TYPOGRAPHY.headingMedium,
    color: THEME.primary,
  },
  button: {
    backgroundColor: THEME.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  }
});
```

## Component Library

The app includes several reusable themed components:

- `Button`: Standard buttons with primary/secondary variants
- `SignOutButton`: Specialized button for signing out
- `TabBar`: Custom navigation bar with the theme
- Various form components and cards

## Gradients

For gradient backgrounds, use the LinearGradient component:

```js
<LinearGradient
  colors={[THEME.gradientStart, THEME.gradientEnd]}
  style={styles.header}
>
  {/* Content */}
</LinearGradient>
```

## Image Upload in React Native

This app includes several methods to reliably upload images to Appwrite from React Native:

### Main Upload Functions

1. **`uploadImageBase64`** - The most reliable method for React Native using Base64 encoding
2. **`uploadProfileImageFromUri`** - Multi-approach function with several fallbacks
3. **`uploadProfileImage`** - For web/browser environments

### How to Use Image Upload

```javascript
import { uploadImageBase64, getFileUrl } from '@/lib/appwrite';

// In your component
const uploadImage = async (imageUri) => {
  try {
    // Upload the image
    const fileId = await uploadImageBase64(imageUri);
    
    // Get the URL to display the image
    const imageUrl = getFileUrl(fileId);
    
    // Now you can use imageUrl in your <Image> component
    return imageUrl;
  } catch (error) {
    console.error("Upload failed:", error);
  }
}
```

### Testing Image Uploads

The app includes a test upload tool at `/test-upload` to help debug file uploads and ensure your storage bucket is configured correctly.

### Required Appwrite Setup

1. Create a storage bucket in your Appwrite console
2. Set permissions appropriately (at least allow file read for 'any')
3. Update the `STORAGE_BUCKET_ID` in `lib/appwrite.ts` with your actual bucket ID

## Troubleshooting

If you encounter upload issues:

1. Verify bucket accessibility using `verifyStorageBucket()` function
2. Check that your bucket ID is correct in `lib/appwrite.ts`
3. Use the test upload tool to diagnose specific issues
4. Check for proper permissions on your storage bucket

## Dependencies

- Appwrite Client SDK
- Expo File System
- Expo Image Picker

# File Migration and Legacy Storage

This app includes tools to handle files across multiple storage buckets and migrate files when needed:

## Storage Bucket Management

1. The current storage bucket ID is configured in `lib/appwrite.ts` as `STORAGE_BUCKET_ID`
2. Legacy bucket IDs are defined in `app/utils/fileMigration.ts` for migration purposes

## File Migration Tools

The app includes tools to migrate files between buckets:

- **Test Upload Tool**: Navigate to `/test-upload` to verify and migrate files
- **Automatic Migration**: The profile component automatically attempts to migrate files that can't be found in the current bucket

## Appwrite Free Tier Image Handling

This app is compatible with Appwrite's free tier where image transformations might not be available:

1. **Direct File Access**: Uses direct file view URLs rather than preview/transformation APIs
2. **Permission Verification**: Includes proper permission checking before attempting access
3. **Robust Fallbacks**: Provides multiple fallback methods if primary access fails

### Setting Up Bucket Permissions

For images to be accessible on the free tier:

1. In your Appwrite Console, go to Storage → Your Bucket
2. Set the following permissions:
   - Read: `any` (allows anyone to view files)
   - Create: `users` or more restrictive
   - Update/Delete: As needed for your application

### Troubleshooting Permission Issues

If you see "not authorized to perform the requested action" errors:

1. Check that your bucket has the correct permissions
2. Ensure your user has the required permissions to upload/access files
3. Try using the Test Upload tool to diagnose specific file issues
4. Use direct URLs with `getFileUrl()` instead of `getFilePreview()`

## How File Migration Works

1. When a file can't be found in the current bucket, the app tries to locate it in legacy buckets
2. If found, it downloads the file and uploads it to the current bucket
3. Then it updates the profile reference to use the new file ID

## Testing File Migration

To test or manually migrate files:

1. Go to the Test Upload screen
2. Enter the file ID in the "Verify Existing File" field
3. Click "Verify" to check if the file exists and is accessible
4. Click "Migrate" to attempt migration from legacy buckets to the current bucket

## Troubleshooting Storage Issues

If you're having issues with file storage:

1. Make sure your current bucket ID is correct in `lib/appwrite.ts`
2. Verify that all referenced legacy bucket IDs still exist in Appwrite
3. Check that your bucket permissions allow file access
4. Use the Test Upload tool to diagnose specific file issues
