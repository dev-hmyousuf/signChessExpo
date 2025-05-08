# Cricket Dynasty Theme System

This document provides a quick reference for using the app's theme system consistently across all pages.

## Theme Colors

The app uses a standardized orange-based color palette defined in `app/utils/theme.ts`:

```js
// Primary colors
primary: '#FF6B00',       // Bright orange (main color)
primaryLight: '#FF8C3D',  // Lighter orange
primaryDark: '#E05A00',   // Darker orange

// Secondary colors
secondary: '#FFE0CC',     // Very light orange
accent: '#FFA366',        // Soft orange

// Functional colors
success: '#4CAF50',       // Green
danger: '#F44336',        // Red
warning: '#FFC107',       // Amber
info: '#FF6B00',          // Same as primary

// Neutral colors
light: '#FFFAF5',         // Very light orange tint
lightGray: '#F5F5F5',     // Light gray
mediumGray: '#9E9E9E',    // Medium gray
darkGray: '#616161',      // Dark gray
dark: '#212121',          // Nearly black

// Basic colors
white: '#FFFFFF',
black: '#000000',

// Gradient colors
gradientStart: '#FF6B00', // Primary orange 
gradientEnd: '#FF4500',   // Darker orange-red

// Transparent versions
primaryTransparent: 'rgba(255, 107, 0, 0.1)',
darkTransparent: 'rgba(0, 0, 0, 0.5)',

// Text colors
textPrimary: '#212121',   // For most text
textSecondary: '#757575', // For secondary text
textLight: '#FFFFFF',     // For text on dark backgrounds
```

## How to Use the Theme

Always import theme constants in your component files:

```js
import { THEME, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '@/app/utils/theme';
```

### Common Components

1. **Buttons**
   ```js
   <TouchableOpacity
     style={{
       backgroundColor: THEME.primary,
       padding: SPACING.md,
       borderRadius: BORDER_RADIUS.md,
       ...SHADOWS.small,
     }}
   >
     <Text style={{ color: THEME.white, ...TYPOGRAPHY.button }}>
       Button Text
     </Text>
   </TouchableOpacity>
   ```

2. **Cards**
   ```js
   <View
     style={{
       backgroundColor: THEME.white,
       borderRadius: BORDER_RADIUS.lg,
       padding: SPACING.md,
       ...SHADOWS.small,
     }}
   >
     <Text style={{ ...TYPOGRAPHY.headingSmall, color: THEME.textPrimary }}>
       Card Title
     </Text>
   </View>
   ```

3. **Form Inputs**
   ```js
   <View>
     <Text style={{ ...TYPOGRAPHY.bodyMedium, color: THEME.textPrimary }}>
       Label
     </Text>
     <TextInput
       style={{
         backgroundColor: THEME.light,
         borderColor: THEME.lightGray,
         borderWidth: 1,
         borderRadius: BORDER_RADIUS.md,
         padding: SPACING.md,
         color: THEME.textPrimary,
       }}
     />
   </View>
   ```

4. **List Items**
   ```js
   <TouchableOpacity
     style={{
       flexDirection: 'row',
       alignItems: 'center',
       padding: SPACING.md,
       borderBottomWidth: 1,
       borderBottomColor: THEME.lightGray,
     }}
   >
     <Text style={{ ...TYPOGRAPHY.bodyLarge, color: THEME.textPrimary }}>
       List Item
     </Text>
   </TouchableOpacity>
   ```

5. **Badges**
   ```js
   <View
     style={{
       backgroundColor: THEME.primaryTransparent,
       borderRadius: BORDER_RADIUS.round,
       paddingHorizontal: SPACING.sm,
       paddingVertical: SPACING.xs,
     }}
   >
     <Text style={{ color: THEME.primary, ...TYPOGRAPHY.bodySmall }}>
       Badge Text
     </Text>
   </View>
   ```

## Typography Presets

Use typography presets for consistent text styling:

```js
<Text style={TYPOGRAPHY.headingLarge}>Large Heading</Text>
<Text style={TYPOGRAPHY.headingMedium}>Medium Heading</Text>
<Text style={TYPOGRAPHY.headingSmall}>Small Heading</Text>
<Text style={TYPOGRAPHY.bodyLarge}>Large Body Text</Text>
<Text style={TYPOGRAPHY.bodyMedium}>Medium Body Text</Text>
<Text style={TYPOGRAPHY.bodySmall}>Small Body Text</Text>
<Text style={TYPOGRAPHY.button}>Button Text</Text>
<Text style={TYPOGRAPHY.caption}>Caption Text</Text>
```

## Spacing

Use consistent spacing values:

```js
// Available spacing values
SPACING.xs: 4,
SPACING.sm: 8,
SPACING.md: 16,
SPACING.lg: 24,
SPACING.xl: 32,
SPACING.xxl: 48,
```

## Border Radius

Consistent border radius values:

```js
// Available border radius values
BORDER_RADIUS.sm: 4,
BORDER_RADIUS.md: 8,
BORDER_RADIUS.lg: 16,
BORDER_RADIUS.xl: 24,
BORDER_RADIUS.round: 9999, // For circles
```

## Shadows

Use shadow presets for depth:

```js
// Shadow presets
SHADOWS.small
SHADOWS.medium
SHADOWS.large
```

## Gradients

For gradient backgrounds:

```js
import { LinearGradient } from 'expo-linear-gradient';

<LinearGradient
  colors={[THEME.gradientStart, THEME.gradientEnd]}
  style={styles.container}
>
  {/* Content */}
</LinearGradient>
``` 