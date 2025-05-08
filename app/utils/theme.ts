export const THEME = {
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
  
  // Neutral colors
  light: '#FFFAF5', // Very light orange tint
  lightGray: '#F5F5F5', // Light gray
  mediumGray: '#9E9E9E', // Medium gray
  darkGray: '#616161', // Dark gray
  dark: '#212121', // Nearly black
  
  // Basic colors
  white: '#FFFFFF',
  black: '#000000',
  
  // Gradient colors
  gradientStart: '#FF6B00', // Primary orange
  gradientEnd: '#FF4500', // Darker orange-red
  
  // Transparent versions (for overlays, backgrounds)
  primaryTransparent: 'rgba(255, 107, 0, 0.1)',
  darkTransparent: 'rgba(0, 0, 0, 0.5)',
  
  // Text colors
  textPrimary: '#212121', // For most text
  textSecondary: '#757575', // For secondary text
  textLight: '#FFFFFF', // For text on dark backgrounds
};

// Typography presets
export const TYPOGRAPHY = {
  headingLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  headingMedium: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  headingSmall: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    color: THEME.textPrimary,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    color: THEME.textPrimary,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    color: THEME.textSecondary,
  },
  button: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textLight,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: THEME.textSecondary,
  },
};

// Spacing scale
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radii
export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  round: 9999,
};

// Shadows
export const SHADOWS = {
  small: {
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: THEME.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
}; 