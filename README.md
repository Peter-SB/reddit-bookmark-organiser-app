# Reddit Bookmark Manager - POC 📱

A modern React Native app built with Expo for saving and organizing Reddit posts. This POC demonstrates the core functionality of adding, rating, and managing Reddit bookmarks with a clean, minimalist UI.

## Features ✨

- **Add Reddit Posts**: Paste any Reddit URL to save posts
- **Star Rating System**: Rate posts from 0-5 stars with half-star precision
- **Read/Unread Toggle**: Mark posts as read with a simple tap
- **Local Storage**: SQLite database for persistent, offline storage
- **Modern UI**: Clean card-based design with consistent spacing and typography
- **Cross-Platform**: Works on iOS, Android, and Web

## Project Structure 📁

```
/app                   ← Expo Router entry points
  /(tabs)/
    index.tsx          ← Main bookmarks screen
    explore.tsx        ← Settings/about screen
/components            ← Reusable UI components
  InputBar.tsx         ← URL input with validation
  PostCard.tsx         ← Bookmark card component
  StarRating.tsx       ← Interactive star rating
/constants             ← Design tokens (colors, spacing, typography)
/hooks                 ← Custom React hooks
  usePostStore.ts      ← SQLite data management
  useScraper.ts        ← Reddit URL data extraction (stubbed)
/models                ← TypeScript interfaces
  Post.ts              ← Post data model
```

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## How to Use 🚀

1. **Add a Bookmark**: Paste any Reddit URL in the input field and tap the add button
2. **Rate Posts**: Tap the stars to rate posts from 0-5 stars
3. **Mark as Read**: Tap the circle icon to toggle read/unread status
4. **View Settings**: Switch to the Settings tab for app information

## Tech Stack 🛠️

- **React Native** with Expo SDK 53
- **TypeScript** for type safety
- **Expo Router** for navigation
- **SQLite** for local data persistence
- **Vector Icons** for UI elements
- **Reanimated** for smooth animations

## POC Scope & Future Enhancements 🔮

This POC focuses on core bookmark management. Future versions will include:

- Real Reddit API integration (currently uses mock data)
- User authentication and cloud sync
- Advanced filtering and search
- Categories and tags
- Export/import functionality
- Dark mode theme switching

## Architecture Highlights 🏗️

- **Repository Pattern**: Abstracted data layer for easy SQLite → Cloud migration
- **Custom Hooks**: Business logic separated from UI components
- **Design System**: Consistent colors, spacing, and typography constants
- **TypeScript**: Full type safety across the entire codebase
- **Component Composition**: Reusable, testable UI components

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
