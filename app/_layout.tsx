import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/useColorScheme";
import { DatabaseService } from "../services/DatabaseService";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const router = useRouter();

  useEffect(() => {
    DatabaseService.getInstance().catch((err) => {
      console.error("Failed to initialize database:", err);
    });
    console.log("DatabaseService initialized");
  }, []);

  // Handle incoming shared Reddit URLs
  useEffect(() => {
    const handleUrl = (url: string) => {
      if (url && url.includes("reddit.com")) {
        // Pass the shared URL as a param to index
        router.replace({ pathname: "/index", params: { sharedUrl: url } });
      }
    };

    // Listen for URLs while app is open
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    // Handle initial launch with URL
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    return () => sub.remove();
  }, [router]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: true }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
