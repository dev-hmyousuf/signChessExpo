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

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
}) => {
  const containerStyles: ViewStyle[] = [
    styles.base,
    stylesBySize[size],
    stylesByVariant[variant],
    disabled ? styles.disabled : {},
    style || {},
  ];

  const textStyles: TextStyle[] = [
    styles.text,
    textByVariant[variant],
    size === "sm" ? styles.textSm : size === "lg" ? styles.textLg : {},
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      style={containerStyles}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? THEME.white : THEME.primary} />
      ) : (
        <Text style={textStyles}>{label}</Text>
      )}
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
});

const stylesBySize: Record<string, ViewStyle> = {
  sm: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  md: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lg: {
    paddingHorizontal: 20,
    paddingVertical: 12,
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
