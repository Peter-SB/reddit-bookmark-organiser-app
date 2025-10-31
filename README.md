# My Reddit Bookmark App and How I Integrated AI

As anyone who uses Reddit know, saving and then searching for anything interesting in a nightmare. Your saved posts is just a long list with no way of filtering it down resulting in endless scrolling for a post you may or may not have remembered to save. There's also the sneaky 1000 post cap on the number of post you can save* (it's a bit more complicated than that, you can still find them but you have to request your Reddit data or start unpacking post). And god forbid you need to access anything offline.

The issue I kept running into while using my notes app to keep posts was that the clipboard would truncate long text. Plus I would have to save the original link to find it again later.

Having used a lot of React and Typescript recently to build some front-ends for a couple of apps and website, I wanted to explore building with React Native, [a multiplatform mobile native version of react?].

I focused clean minimalist design approach with initiatives user experience, offline storage, extensive search functionality, and post customisation.

I wanted to be able to quickly add posts, mark them are read/favourite, give them ratings, make notes for later, and untimely organise anything useful I found while browsing for later.

**Note** that while this project taught me a lot, but the main aim was just to build something fun and there is a lot of further optimisation and refactoring possible. I however have other priorities and just wanted to post this and share what I've built so far.

# Key Features 

## Integration With Reddit API
While initially I was scraping Reddit without using the official API, I ran into rate limits, bot detection, and this approach ultimately proved unreliable so I moved to use the official Reddit API. When you add a post a request is made to the API for the relevant post data.

## SQLite Database
For simple and reliable offline storage on mobile devices, SQLite was the no brainer. Storing the post data in an SQLite database also allowed for quick switching to other bookmark libraries or easy backup and restores.

Use a SQLite database came with its own challenge such as connections being automatically binned by the mobile operating system but they were all addressed.

A repository pattern was used as a layer between the database and service hooks for cleaner code [fact check and come back to here].

## Post Customisation 
I wanted to be able to have a lot of options when it came to saving and then customising posts. Posts can be favourited, read/unread, have a start rating. Posts can also be edited incase I wanted to add my own notes or remove filler text. I also added a custom notes section for keeping my own thoughts on a post separate to the post body. I even added a neat folder system with some nice UI for keeping posts organised within topics.

## Searching and Filtering 
The standard search and filtering [levers? Word] are present. Searching body/title/author. Sort by date/rating/read/favourite. I also added a random button to take you to any post on your filtered list.

## Deduplication with Minhash
Given the tendancy for reposts, cross-posts, I wanted to be able to detect posts I already had saved, beyond just a title match.

I experimented with two different simple [hashing?] algorithms to match duplicate posts. Simple hash and Min hash. While the Simple hash washing precise enough and provided too many false positives, the Minhash approaches worked excellently for finding matches of posts with only minor deviations.

The post body Minhash values were precomputed as added to the database to be later compared against any newly added post.


## UI Design Choices 
I had a lot of fun focusing on the design choices in the app and building it with user experience in mind. Simple clean interface, initiative buttons, and smooth interactions were all at the heart of the design of this app and I'm happy with the results. I wanted to avoid the clunky feeling of simple apps and paid a lot of attention to this aspect.


# React Native + Expo Go
React Native and Expo Go were an excellent choice of fast iterative design allowing me to quickly build and test this app. Especially for any developer with React web experience, there is much less new to wrap you hear around than learning Kaitlin/Java, swift, or [...].

While not exactly the same as React web, the overall feel and standards pattern were still similar and Expo Go allowed for a quick test cycle.

### What I learned:
- more about mobile memory management 
- mobile data management and permissions 

### Biggest Struggles 
- formatting for mobile devices
- keyboard layouts
- getting the list to be smooth, especially the search bar at the top
- memory and object binning 
- 



# How I Integrated AI
Having been exploring a lot of AI tech recently [rephrase this] I wanted to integrate an AI summary feature into the app. This was a surprisingly simple feature but ended up looking very clean and was very helpful and taught more about integrating AI features into applications.

The summary feature works by sending off the post to a AI endpoint, in this case an AI endpoint I was self-hosting but any openAI protocol endpoint would work. Then streaming the response data back into the app. This resulted in the classic AI writing stream look standard to any of the classic AI web interfaces. 

While the prompting was a minimal aspect, and the summary feature simple, this still showed how AI can be easily and intentionaly added as features for improving user experience.

### Further Investigation 
With this was just a little experiment, I wanted to go further with to and add a RAG search and even an AI interface to query you library. 

I drew up plans to use a vector database such as [xx] but was worries about the resource constraints on the device. While simple similarly search was possible, I wanted to expand this with RAG but this would likely have required  hosting the database [Todo: research the requirements, propose a hypothetical solution. Explain how a simple rag agent could have been added, explain why no (time, phone resource constraints, library that exist already, refactoring neede)]
