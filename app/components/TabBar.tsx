import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@clerk/clerk-expo';
import { THEME } from '@/app/utils/theme';

// স্ক্রিন ডাইমেনশন নেওয়া
const { width } = Dimensions.get('window');

const TabBar = ({ state, descriptors, navigation }) => {
  const { isSignedIn, user } = useAuth();
  
  // ইউজার রোল নির্ধারণ করা
  const getUserRole = () => {
    if (!isSignedIn) return 'guest';
    
    const userMetadata = user?.publicMetadata || {};
    
    if (userMetadata.isAdmin) return 'admin';
    if (userMetadata.isOrganizer) return 'organizer';
    return 'player';
  };
  
  const userRole = getUserRole();
  
  // ইউজার রোল অনুযায়ী দৃশ্যমান ট্যাব ফিল্টার করা
  const getVisibleTabs = () => {
    const allTabs = state.routes.map((route, index) => ({
      route,
      index,
      name: route.name
    }));
    
    // অর্গানাইজার রোলের জন্য ড্যাশবোর্ড ট্যাব দেখানো নিশ্চিত করা
    if (userRole === 'organizer') {
      return allTabs;
    }
    
    return allTabs.filter(tab => tab.route.name !== 'organizer-dashboard');
  };
  
  const visibleTabs = getVisibleTabs();
  
  // দৃশ্যমান ট্যাব অনুযায়ী ট্যাব উইডথ গণনা করা
  const tabWidth = width / visibleTabs.length;
  
  return (
    <LinearGradient
      colors={[THEME.primaryDark, THEME.primary]}
      style={[
        styles.container,
        Platform.OS === 'android' ? styles.androidContainer : styles.iosContainer
      ]}
    >
      {visibleTabs.map((tab) => {
        const { options } = descriptors[tab.route.key];
        const label = options.tabBarLabel || options.title || tab.route.name;
        const isFocused = state.index === tab.index;
        
        // রুট নাম অনুযায়ী আইকন নির্ধারণ করা
        const getIcon = () => {
          const routeName = tab.route.name;
          
          if (routeName === 'index') return 'home';
          if (routeName === 'tournaments') return 'trophy';
          if (routeName === 'matches') return 'game-controller';
          if (routeName === 'profile') return 'person';
          if (routeName === 'organizer-dashboard') return 'stats-chart';
          
          return 'apps';
        };
        
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: tab.route.key,
            canPreventDefault: true,
          });
          
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(tab.route.name);
          }
        };
        
        return (
          <TouchableOpacity
            key={tab.route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            style={[
              styles.tab,
              { width: tabWidth },
              Platform.OS === 'android' ? styles.androidTab : styles.iosTab
            ]}
          >
            <Ionicons
              name={`${getIcon()}${isFocused ? '' : '-outline'}`}
              size={Platform.OS === 'android' ? 22 : 24}
              color={isFocused ? THEME.white : 'rgba(255, 255, 255, 0.7)'}
            />
            <Text 
              style={[
                styles.label,
                isFocused ? styles.labelFocused : styles.labelUnfocused,
                Platform.OS === 'android' ? styles.androidLabel : styles.iosLabel
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  iosContainer: {
    height: 85,
    paddingBottom: 30, // iOS হোম ইন্ডিকেটরের জন্য
  },
  androidContainer: {
    height: 60,
    elevation: 8, // অ্যান্ড্রয়েড শ্যাডো
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosTab: {
    paddingTop: 8,
  },
  androidTab: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  label: {
    marginTop: 2,
    textAlign: 'center',
  },
  labelFocused: {
    color: THEME.white,
    fontWeight: '600',
  },
  labelUnfocused: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  androidLabel: {
    fontSize: 11, // অ্যান্ড্রয়েডের জন্য একটু ছোট
    marginTop: 1,
  },
  iosLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default TabBar;