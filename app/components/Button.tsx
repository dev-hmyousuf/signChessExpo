import React from "react";
import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from "react-native";
import { THEME, BORDER_RADIUS } from "../utils/theme";
import { LinearGradient } from 'expo-linear-gradient';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  gradient?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
  gradient = false,
}) => {
  const containerStyles: ViewStyle[] = [
    styles.base,
    stylesBySize[size],
    !gradient && stylesByVariant[variant],
    disabled ? styles.disabled : {},
    style || {},
  ];

  const textStyles: TextStyle[] = [
    styles.text,
    textByVariant[variant],
    size === "sm" ? styles.textSm : size === "lg" ? styles.textLg : {},
  ];

  const renderContent = () => (
    loading ? (
      <ActivityIndicator color={variant === "primary" ? THEME.white : THEME.primary} />
    ) : (
      <Text style={textStyles}>{label}</Text>
    )
  );

  if (gradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={containerStyles}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[THEME.primary, '#F02E85']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradientContainer, stylesBySize[size]]}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={containerStyles}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER_RADIUS.md,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: "500",
  },
  textSm: {
    fontSize: 12,
  },
  textLg: {
    fontSize: 18,
  },
  gradientContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
  }
});

const stylesBySize: Record<string, ViewStyle> = {
  sm: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  md: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lg: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
};

const stylesByVariant: Record<string, ViewStyle> = {
  primary: {
    backgroundColor: THEME.primary,
  },
  secondary: {
    backgroundColor: THEME.white,
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
};

const textByVariant: Record<string, TextStyle> = {
  primary: {
    color: THEME.white,
  },
  secondary: {
    color: THEME.primary,
  },
};

// Export Button as default
export default Button;
