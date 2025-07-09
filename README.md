A simple react native app for saving, storing, and organising your favourite Reddit posts. Designed with simplicity and (word for meaning fast and ergonomical), keep track of posts by.

 

One main reason this app was built was because of the immense size of saved Reddit posts I have, and that I've had issues with my phone’s clipboard truncating long posts when trying to save to a generic notes app.

Features:

- Save Reddit posts locally. Enter a post URL and the app will fetch the post data for offline local storage
- Organise and Edit. Favourite, tag, notes, rating, read-status, and local editing of posts.
- De-duplication. Avoid resaving posts with checks of matching content in your library
- Export posts for backups or other uses
- Simple, intuitive ui

# Technical Notes

### Expo Go and OAuth Redirect

I was struggling to use Reddit's OAuth flow because I was testing the app with Expo Go, which doesn't support the way I was trying because the flow needed a redirect url, which works for built expo apps, but Expo Go doesn't have the schema name needed for the app to redirect to. Because this is just a little test app, I've decided to switch to a client/secret auth, instead of OAuth.

## Expo SQLite

- 

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
