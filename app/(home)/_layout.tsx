import React, { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, View, Text } from "react-native";
import { account, getCurrentSession } from '@/lib/appwrite';
import { 
  isOrganizer, 
  isDynastyAdmin, 
  hasAdminPrivileges 
} from '@/lib/permissionsHelper';
import { THEME } from '@/app/utils/theme';
import { useUser } from '@clerk/clerk-expo';

// Admin configuration
// Global admins/organizers who have access to everything
const ORGANIZER_IDS = ['681cceadb2ee3ee8c1ff'];

/* 
 * APPWRITE PERMISSIONS STRUCTURE
 * =============================
 * For a proper role-based admin system, you need to set up permissions in Appwrite:
 *
 * 1. Create an "admin_roles" collection with these fields:
 *    - clerkId: string (user's ID from Clerk)
 *    - role: string (either "organizer" or "dynasty_admin")
 *    - dynastyId: string (country ID that the dynasty admin can manage, only for dynasty_admin role)
 *
 * 2. Set up document-level permissions in your collections:
 *    - ORGANIZERS: Should have read/write access to all collections
 *    - DYNASTY ADMINS: Should have conditional access based on dynastyId/countryId:
 *      - Can view all documents 
 *      - Can only edit/modify documents related to their dynasty
 *
 * 3. Example using Appwrite roles:
 *    $permissions = [
 *      // Public read access
 *      Permission.read(Role.any()),
 *      
 *      // Organizers have full access
 *      Permission.write(Role.users('organizer')),
 *      
 *      // Dynasty admins have conditional access
 *      // This requires custom functions in Appwrite to check conditions
 *    ];
 */

// Dynasty admin roles will be fetched from database
interface AdminRole {
  clerkId: string;
  role: 'organizer' | 'dynasty_admin';
  dynastyId?: string; // Country/dynasty ID for dynasty admins
}

export default function Layout() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userIsOrganizer, setUserIsOrganizer] = useState(false);
  const [userIsDynastyAdmin, setUserIsDynastyAdmin] = useState(false);
  const [adminDynastyId, setAdminDynastyId] = useState<string | null>(null);
  const [clerkId, setClerkId] = useState<string | null>(null);
  const router = useRouter();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();

  // Debug effect to monitor admin state changes
  useEffect(() => {
    console.log("Admin state changed:");
    console.log("- isAdmin:", isAdmin);
    console.log("- userIsOrganizer:", userIsOrganizer);
    console.log("- userIsDynastyAdmin:", userIsDynastyAdmin);
    console.log("- adminDynastyId:", adminDynastyId);
  }, [isAdmin, userIsOrganizer, userIsDynastyAdmin, adminDynastyId]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if Clerk user is loaded
        if (!isClerkLoaded || !clerkUser) {
          console.log("Clerk user not loaded yet or not signed in");
          setIsLoaded(true);
          return;
        }

        // Get Clerk user ID
        const currentClerkId = clerkUser.id;
        setClerkId(currentClerkId);
        
        console.log("Checking for admin status");
        console.log("Current Clerk user ID:", currentClerkId);
        
        // Check if user is an organizer (highest level admin) using the helper
        const organizerStatus = await isOrganizer(currentClerkId);
        setUserIsOrganizer(organizerStatus);
        
        // Check if user is a dynasty admin using the helper
        const dynastyAdminStatus = await isDynastyAdmin(currentClerkId);
        setUserIsDynastyAdmin(dynastyAdminStatus.isDynastyAdmin);
        setAdminDynastyId(dynastyAdminStatus.dynastyId);
        
        // Overall admin status - either organizer or dynasty admin
        const isAnyAdmin = organizerStatus || dynastyAdminStatus.isDynastyAdmin;
        setIsAdmin(isAnyAdmin);
        
        console.log("User is admin:", isAnyAdmin);
        console.log("User is organizer:", organizerStatus);
        console.log("User is dynasty admin:", dynastyAdminStatus.isDynastyAdmin);
        if (dynastyAdminStatus.isDynastyAdmin) {
          console.log("Dynasty ID:", dynastyAdminStatus.dynastyId);
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    checkAuth();
  }, [isClerkLoaded, clerkUser]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  console.log("Rendering Tabs with isAdmin =", isAdmin);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.darkGray,
      }}
    >
      {/* Main tab screens - these will display in the TabBar */}
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          )
        }} 
      />

      {/* Main admin dashboard - only for organizers */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
          href: userIsOrganizer ? undefined : null,
        }}
      />
     
      {/* Dynasty Admin dashboard - for country-specific admins */}
      <Tabs.Screen
        name="dynasty-admin"
        options={{
          title: "Dynasty Admin",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flag" size={size} color={color} />
          ),
          href: userIsDynastyAdmin ? undefined : null,
        }}
      />
      
      <Tabs.Screen 
        name="chat" 
        options={{ 
          title: "Chat",
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          )
        }} 
      />
      
      <Tabs.Screen 
        name="tournament" 
        options={{ 
          title: "Tournament",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          )
        }} 
      />
      
      <Tabs.Screen 
        name="chess" 
        options={{ 
          title: "Chess",
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="game-controller" size={size} color={color} />
          )
        }} 
      />
      
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
          href: "/profile"
        }} 
      />
      
      {/* Dynamic routes - use the expo-router recommended pattern */}
      <Tabs.Screen name="match" options={{ href: null }} />
      <Tabs.Screen name="match/[matchId]" options={{ href: null }} />
      <Tabs.Screen name="tournament/[dynasty]" options={{ href: null }} />
      <Tabs.Screen name="player-registration" options={{ href: null }} />
      <Tabs.Screen name="dev-tools" options={{ href: null }} />
      <Tabs.Screen name="restore-countries" options={{ href: null }} />
      <Tabs.Screen name="test-upload" options={{ href: null }} />
    </Tabs>
  );
}

