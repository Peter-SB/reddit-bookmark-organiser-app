import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import * as NavigationBar from "expo-navigation-bar";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import "react-native-reanimated";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme } from "@/hooks/useColorScheme";
import { usePostSync } from "@/hooks/usePostSync";
import { DatabaseService } from "../services/DatabaseService";
import { AppState } from "react-native";
import {
  ThemeProvider as AppThemeProvider,
  useTheme,
} from "@/contexts/ThemeContext";

function AppContent() {
  const colorScheme = useColorScheme();
  const { isDarkMode, palette } = useTheme();
  const router = useRouter();
  usePostSync(); // start periodic syncing of posts when started

  // Keep system nav bar and background colour in sync with theme
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.background);
    NavigationBar.setStyle(isDarkMode ? "light" : "dark");
  }, [palette.background]);

  // Make navigation bar transparent
  useEffect(() => {
    NavigationBar.setPositionAsync("absolute");
    NavigationBar.setBackgroundColorAsync("#ffffff01");
  }, []);

  useEffect(() => {
    DatabaseService.getInstance().catch((err) => {
      console.error("Failed to initialize database:", err);
    });
    console.log("DatabaseService initialized");
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // Reopen if needed; cheap due to health check + in-flight lock
        DatabaseService.getInstance().catch((e) =>
          console.error("DB re-open on resume failed", e),
        );
      }
    });
    return () => sub.remove();
  }, []);

  // Handle incoming shared Reddit URLs: todo check
  useEffect(() => {
    const handleUrl = (url: string) => {
      if (url && url.includes("reddit.com")) {
        // Pass the shared URL as a param to index
        alert("Shared URL detected: " + url);
        router.replace({ pathname: "/", params: { sharedUrl: url } });
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

  const navTheme = isDarkMode
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: palette.background,
          card: palette.background,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: palette.background,
          card: palette.background,
        },
      };

  return (
    <ThemeProvider value={navTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="highlights" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="semantic-search" options={{ headerShown: false }} />
        <Stack.Screen
          name="semantic-search/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="semantic-search/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="similar/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="author/[author]" options={{ headerShown: false }} />
        <Stack.Screen name="author/import" options={{ headerShown: false }} />
        <Stack.Screen name="author/authors" options={{ headerShown: false }} />
        <Stack.Screen
          name="subreddit/subreddits"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="subreddit/[subreddit]"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <AppContent />
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
