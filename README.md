<p align="center">
    <img src="assets/images/custom-adaptive-icon-cropped.png" alt="App Logo" height="300">

</p>

# Simple Reddit Bookmark App and How I Integrated AI

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

# Adding AI
## Chat Completions In React Native

Having been experimenting with a lot of AI tech recently, I wanted to integrate some simple AI functionally into my app. An AI summary feature seemed an obvious choice for this app and I aimed to integrate it in a natural and aesthetic way. 

I wanted to emulate the classic AI streamed response, the text that instantly displays when generating as the model writes. This gives the integration a fast and native feel, not waiting for a static blob of text to appear. The response time, especially in cases of long response or when using slower self-hosted models, has a huge effect on user experience. Long delays can feel awkward or even concern the user something has gone wrong. Streaming the response also has the added benefit of letting the user start reading before the response has even finished generating.

In this section we will go over how to implement streamed chat completions in React Native, but the approach would be similar for React or other technologies. This was a surprisingly simple feature and ended up looking very clean and still taught me a lot about integrating AI features into applications.
### Server-Sent Events (SSE)

To achieve this streamed chat competition affect we'll use the same streaming approach popularised by ChatGPT, Server-Sent Events. SSE is a lightweight, one way communication channel where a server will send data incrementally over a single HTTP connection. 

We will use the `chat/completeions` endpoint provided by most OpenAI compatible APIs. We can enable the streaming of data by including `"stream": true` in our request body. Then the server sends incremental tokens as `text/event-stream` data until finally ending with `[DONE]` event.

Each chunk will look like:

```
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" world!"}}]}
data: [DONE]
```

In React Natives we will use `EventSource` (provided by the library `react-native-sse`) to implement this connection. We will listen for each delta message and, unless it's the final `Done` message, we will append the new data to our stored ongoing response.

``` javascript
import EventSource from "react-native-sse";

function startSSEChat(endpoint, payload, onDelta, onFinish) {
  const es = new EventSource(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true }),
  });

  es.addEventListener("message", (event) => {
    const raw = event.data?.trim();
    if (raw === "[DONE]") {
      es.close();
      onFinish?.();
      return;
    }

    try {
      const json = JSON.parse(raw);
      const delta = json?.choices?.[0]?.delta?.content || "";
      if (delta) onDelta(delta);
    } catch {
      console.log("Non-JSON frame:", raw);
    }
  });

  return es;
}

```
 *Note: JavaScript for readability 

This approach has the benefits of low memory, fast responsiveness, and quick cancellation by simply closing the SSE connection.

**Prompt**
The prompt was super simple, just `You are an assistant that summarises reddit posts in 3-4 lines`. However this could be changed in the app settings.

**UI State Machine**
The UI follows a simple four-state flow: `idle -> loading -> success | error`. This can be interrupted mid loading and regenerated. The streamed text is store temporarily and only saved to the post database when the post is saved.

Though simple, this still shows how AI can be quickly but intentionally added as features for improving user experience with a fast and native feel delivering great user experience.

## Further Implementations: Semantic Search and RAG

To expand the search capability, and my own understanding, I also looked into using vector databases to allow for semantic search. This is a precursor to RAG and even a simple semantic search would have allowed for some more advanced post filtering.

We would precompute chunked post data into vectors representing semantic meaning using a lightweight encoder such as OpenAI’s text-embedding model. Then we could compare similarity using using simple cosine similarity or dot-product to find closet matches.

The next step after semantic search would have been to have been to implement RAG (Retrieval-Augmented Generation), allowing the post database to be the knolage base for an LLM. By injecting results from a semantic search into the prompt for an LLM, users could query and interact with their database. 

While I made some progress into looking into this, the challenges I faced were storage, and computational requirements on mobile. Especially generating the embeddings and the searching across large datasets. I did consider precomputing embeddings server-side but this project was quickly growing out of hand. There are also the model hosting constraints and data privacy issue faced if this app was to be made public but luckly this remains just a little passion project.

It would have been very interesting to investigate some full RAG implementations and architectures, however I think this would be best suited for future projects, especialy where im not constrained by mobile capabilities.

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
