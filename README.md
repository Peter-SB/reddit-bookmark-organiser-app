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


 

One main reason this app was built was because of the immense size of saved Reddit posts I have, and that I've had issues with my phone’s clipboard truncating long posts when trying to save to a generic notes app.

Features:

- Save Reddit posts locally. Enter a post URL and the app will fetch the post data for offline local storage
- Organise and Edit. Favourite, tag, notes, rating, read-status, and local editing of posts.
- De-duplication. Avoid resaving posts with checks of matching content in your library
- Export posts for backups or other uses
- Simple intuitive ui

# Technical Notes

## State Management and Data Persistence

Important to have a reactive UI interface backed by a reliable truth source persistent database but doing this well can be difficult. Keeping the two in sync can be the hardest part.


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


Using hook/repository/data service lalyers pattern. Expo provides a solid sqlite library. Considered using something like Drizzle for ORM but decided not to for the scale of this app (one to look into more next time).

For the database instance, I've used a singleton pattern as opposed to, for example, the react context hook pattern, just because of the simplicity of the app. Thoughts this has it's train offs being harder to test.

# Expo

### Expo Go and OAuth Redirect

I was struggling to use Reddit's OAuth flow because I was testing the app with Expo Go, which doesn't support the way I was trying because the flow needed a redirect url, which works for built expo apps, but Expo Go doesn't have the schema name needed for the app to redirect to. Because this is just a little test app, I've decided to switch to a client/secret auth, instead of OAuth.

## Building Expo Package

*Expo account required

- `npm install -g eas-cli`
- `eas login`
- `eas build:configure`
- in eas.json - `developmentClient=true`
- `npx expo install expo-dev-client -- --legacy-peer-deps`
- `eas build --platform android --profile development`


## 



## Paterns

- Use

## Todo

- Better credential storing. OAuth or save creds in settings
- Link to subreddits and usernames
- Search functionality
- Switch Database from settings

Stretch Goals

- Cloud Backup
- User Saved Posts selection and subreddit search
