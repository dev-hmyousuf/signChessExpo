import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, View, Text } from "react-native";
import { account, getCurrentSession } from '@/lib/appwrite';
import { 
  isOrganizer, 
  isDynastyAdmin, 
  hasAdminPrivileges 
} from '@/lib/permissionsHelper';
import { THEME } from '@/app/utils/theme';

// Admin configuration
// Global admins/organizers who have access to everything
const ORGANIZER_IDS = ['681a53f30021a9da4562', '681a4e7c0000eaa7dc45'];

/* 
 * APPWRITE PERMISSIONS STRUCTURE
 * =============================
 * For a proper role-based admin system, you need to set up permissions in Appwrite:
 *
 * 1. Create an "admin_roles" collection with these fields:
 *    - userId: string (user's ID from Appwrite)
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
  userId: string;
  role: 'organizer' | 'dynasty_admin';
  dynastyId?: string; // Country/dynasty ID for dynasty admins
}

export default function Layout() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userIsOrganizer, setUserIsOrganizer] = useState(false);
  const [userIsDynastyAdmin, setUserIsDynastyAdmin] = useState(false);
  const [adminDynastyId, setAdminDynastyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
        const session = await getCurrentSession();
        if (session) {
          // Get user data from account
          const userData = await account.get();
          const currentUserId = userData.$id;
          setUserId(currentUserId);
          
          console.log("Checking for admin status");
          console.log("Current user ID:", currentUserId);
          
          // Check if user is an organizer (highest level admin) using the helper
          const organizerStatus = await isOrganizer(currentUserId);
          setUserIsOrganizer(organizerStatus);
          
          // Check if user is a dynasty admin using the helper
          const dynastyAdminStatus = await isDynastyAdmin(currentUserId);
          setUserIsDynastyAdmin(dynastyAdminStatus.isDynastyAdmin);
          setAdminDynastyId(dynastyAdminStatus.dynastyId);
          
          // Overall admin status - either organizer or dynasty admin
          const isAnyAdmin = organizerStatus || dynastyAdminStatus.isDynastyAdmin;
          setIsAdmin(isAnyAdmin);
          
          console.log("User is admin:", isAnyAdmin);
          console.log("User is organizer:", userIsOrganizer);
          console.log("User is dynasty admin:", dynastyAdminStatus.isDynastyAdmin);
          if (dynastyAdminStatus.isDynastyAdmin) {
            console.log("Dynasty ID:", dynastyAdminStatus.dynastyId);
          }
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    checkAuth();
  }, []);

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
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName: React.ComponentProps<typeof Ionicons>["name"] = "home";

          switch (route.name) {
            case "index":
              iconName = "home";
              break;
            case "dashboard":
              iconName = "grid";
              break;
            case "admin-roles":
              iconName = "people";
              break;
            case "dynasty-admin":
              iconName = "flag";
              break;
            case "profile":
              iconName = "person";
              break;
            case "chat": 
              iconName = "chatbubble-ellipses";
              break;
            case "tournament":
              iconName = "trophy";
              break;
            case "chess":
              iconName = "game-controller";
              break;
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.darkGray,
      })}
    >
      {/* Main tab screens - these will display in the TabBar */}
      <Tabs.Screen name="index" options={{ title: "Home" }} />

      {/* Main admin dashboard - only for organizers */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          href: userIsOrganizer ? undefined : null, // Only show for organizers
        }}
      />
     

      {/* Dynasty Admin dashboard - for country-specific admins */}
      <Tabs.Screen
        name="dynasty-admin"
        options={{
          title: "Dynasty Admin",
          href: userIsDynastyAdmin ? undefined : null, // Only show for dynasty admins
        }}
      />
      
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="tournament" options={{ title: "Tournament" }} />
      <Tabs.Screen name="chess" options={{ title: "Chess" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      
      {/* Dynamic routes that should be excluded from the TabBar completely */}
      <Tabs.Screen name="match" options={{ href: null }} />
      <Tabs.Screen name="match/[matchId]" options={{ href: null }} />
      <Tabs.Screen name="tournament/[dynasty]" options={{ href: null }} />
      <Tabs.Screen name="player-registration" options={{ href: null }} />
    </Tabs>
  );
}

