# Reddit Post Bookmark Organiser

A simple react native app for saving, storing, and organising your favourite Reddit posts. Designed with simplicity and (word for meaning fast and ergonomical), keep track of posts by.

 

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

1. 

---

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
