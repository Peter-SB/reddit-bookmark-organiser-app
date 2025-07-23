/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// POC color palette
export const palette = {
  background: '#FFF',
  backgroundMidLight: '#fcfcfc',//'#fafafa',
  backgroundDarker: '#f8f8f8',
  foreground: '#111',
  foregroundLight: '#323232',
  foregroundMidLight: '#5a5a5aff',
  accent: '#007AFF',  // iOS blue
  muted: '#888',
  cardShadow: '#00000010',
  border: '#E5E5E5',

  favHeartRed: '#FF4500', 
  starYellow: '#FFB700',

  saveGreen: '#008000', // iOS system green
};
