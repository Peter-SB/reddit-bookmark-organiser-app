import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { darkPalette, palette, Palette } from "@/constants/Colors";
import { scaledFontSizes, fontWeights } from "@/constants/typography";

const DARK_MODE_KEY = "user_dark_mode_preference";

export interface ThemeContextValue {
  palette: Palette;
  fontSizes: ReturnType<typeof scaledFontSizes>;
  fontWeights: typeof fontWeights;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === "dark");
  // null = not yet loaded, true/false = user has a saved preference
  const userPreferenceRef = useRef<boolean | null>(null);

  // On mount, load persisted preference and apply it
  useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_KEY).then((stored) => {
      if (stored !== null) {
        const saved = stored === "true";
        userPreferenceRef.current = saved;
        setIsDarkMode(saved);
      } else {
        // No saved preference — follow system
        userPreferenceRef.current = null;
        setIsDarkMode(systemColorScheme === "dark");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When system color scheme changes, only apply it if the user hasn't set a
  // preference that already matches (or differs intentionally from) the system.
  useEffect(() => {
    const systemIsDark = systemColorScheme === "dark";
    if (userPreferenceRef.current === null) {
      // No user preference — always follow system
      setIsDarkMode(systemIsDark);
    } else if (userPreferenceRef.current === systemIsDark) {
      // User's preference already matches the new system setting — keep in sync
      // (system changed to match what the user wanted, so keep following it)
      userPreferenceRef.current = null;
      setIsDarkMode(systemIsDark);
    }
    // Otherwise the user deliberately chose a mode different from the system;
    // leave their preference in place.
  }, [systemColorScheme]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      userPreferenceRef.current = next;
      AsyncStorage.setItem(DARK_MODE_KEY, String(next));
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      palette: isDarkMode ? darkPalette : palette,
      fontSizes: scaledFontSizes(1.0),
      fontWeights,
      isDarkMode,
      toggleDarkMode,
    }),
    [isDarkMode, toggleDarkMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
