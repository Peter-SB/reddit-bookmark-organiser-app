# Technical Notes For Reddit Bookmark Manager - ⚠️ Work In Progress ⚠️ 

A modern React Native app built with Expo for saving and organising Reddit posts. This POC demonstrates the core functionality of adding, rating, and managing Reddit bookmarks with a clean, minimalist UI.

One main reason this app was built was because of the immense size of saved Reddit posts I have, and that I've had issues with my phone’s clipboard truncating long posts when trying to save to a generic notes app.

## Features 

- **Add Reddit Posts**: Paste any Reddit URL to save posts
- **Star Rating System**: Rate posts from 0-5 stars with half-star precision
- **Read/Unread Toggle**: Mark posts as read with a simple tap
- **Local Storage**: SQLite database for persistent, offline storage
- **Modern UI**: Clean card-based design with consistent spacing and typography
- **Cross-Platform**: Works on iOS, Android, and Web

## Project Structure 


```
reddit-post-organiser-app/
├── components/             # Reusable UI components (cards, sidebar, etc.)
├── constants/              # Design system: colours, spacing, typography
├── hooks/                  # Custom React hooks (business logic, data fetching)
├── models/                 # TypeScript models & types
├── repository/             # Data access layer (Repository Pattern)
├── services/               # App services (Database, MinHash, etc.)
├── utils/                  # Helper functions
├── app/                    # Expo Router pages (navigation, screens)
|   └── post/               # Dynamic post pages
├── app.json                # Expo app config
├── eas.json                # EAS build config
├── package.json            # NPM dependencies & scripts
├── tsconfig.json           # TypeScript config
└── README.md       

```

### Technical Highlights

- **Repository Pattern**: All database access goes through `repository/`, making it easy to swap SQLite for cloud storage later.
- **Custom Hooks**: Business logic (fetching, state) lives in `hooks/`, keeping UI components code clean.
- **Expo Router**: Navigation handled in `app/` using file-based routing.
- **Type Safety**: All models/types in `models/` for typesafe data handling.
- **Testing**: Tested in `/__tests__/` folders.
- **Design System**: Consistent look via `constants/` (colours, spacing, typography).



Features:

- Save Reddit posts locally. Enter a post URL and the app will fetch the post data for offline local storage
- Organise and Edit. Favourite, notes, rating, read-status, and local editing of posts.
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
- Categories 
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
