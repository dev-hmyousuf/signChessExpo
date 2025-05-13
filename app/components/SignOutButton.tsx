import React from 'react'
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { THEME, BORDER_RADIUS } from '@/app/utils/theme'

type SignOutButtonProps = {
  style?: StyleProp<ViewStyle>
}

export function SignOutButton({ style }: SignOutButtonProps) {
  const [loading, setLoading] = React.useState(false)
  const { signOut } = useAuth()

  const onSignOutPress = async () => {
    try {
      setLoading(true)
      await signOut()
      router.replace('/')
    } catch (err) {
      console.error('Error signing out:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onSignOutPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={THEME.danger} />
      ) : (
        <Text style={styles.text}>Sign Out</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)', // Transparent danger color
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: THEME.danger,
    fontWeight: '500',
  },
})

// Export SignOutButton as default
export default SignOutButton;
