import { View } from "react-native";
import ChessScreen from "../components/chess";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function Chess() {
  return (
    <SafeAreaView>
      <StatusBar style="dark" />
      <ChessScreen />
    </SafeAreaView>
  );
}