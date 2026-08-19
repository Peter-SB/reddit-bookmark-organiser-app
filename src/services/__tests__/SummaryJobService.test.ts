import type { Post } from "@/models/models";
import {
  _resetForTesting,
  _setDependenciesForTesting,
  clearJob,
  getJob,
  hasSubscribers,
  revertSummary,
  startSummary,
  stopSummary,
  subscribe,
} from "../SummaryJobService";

// Keeps react-native-sse (and the real network) out of the test process.
jest.mock("@/services/SSEChatService", () => ({ startSSEChat: jest.fn() }));
jest.mock("@/repository/PostRepository", () => ({
  PostRepository: { create: jest.fn() },
}));
jest.mock("@/repository/SettingsRepository", () => ({
  SettingsRepository: { getSettings: jest.fn() },
}));

/** A stream the test drives by hand. */
interface CapturedStream {
  endpoint: string;
  onDelta: (text: string) => void;
  onFinish: () => void;
  onError: (err: any) => void;
  close: jest.Mock;
}

/** Lets queued promise callbacks (the DB writes) run. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    redditId: "abc",
    url: "https://reddit.com/r/test/abc",
    title: "Test post",
    bodyText: "Some body text to summarise",
    author: "someone",
    subreddit: "test",
    redditCreatedAt: new Date("2024-01-01T00:00:00Z"),
    addedAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    isRead: false,
    isFavorite: false,
    folderIds: [],
    ...overrides,
  };
}

describe("SummaryJobService", () => {
  let streams: CapturedStream[];
  let repo: { updateSummaryById: jest.Mock };

  /** The most recently started stream. */
  const latest = () => streams[streams.length - 1];

  beforeEach(() => {
    _resetForTesting();
    streams = [];
    repo = { updateSummaryById: jest.fn().mockResolvedValue(1) };
    _setDependenciesForTesting({
      repo,
      loadSettings: async () => ({
        AI_ENDPOINT_URL: "https://ai.example.com",
        AI_MODEL_ID: "test-model",
      }),
      sseStarter: (args: any) => {
        const close = jest.fn();
        streams.push({ ...args, close });
        return { close };
      },
    });
  });

  afterEach(() => {
    _resetForTesting();
  });

  it("accumulates deltas and notifies only that post's subscribers", async () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    subscribe(1, listenerA);
    subscribe(2, listenerB);

    await startSummary(makePost({ id: 1 }));
    latest().onDelta("Hello ");
    latest().onDelta("world");

    expect(getJob(1)?.text).toBe("Hello world");
    expect(getJob(1)?.status).toBe("streaming");
    expect(listenerA).toHaveBeenCalled();
    expect(listenerB).not.toHaveBeenCalled();
  });

  describe("flow 1 — finishes while the user is elsewhere", () => {
    it("saves the summary and drops the job", async () => {
      await startSummary(makePost({ id: 1, summary: "old summary" }));
      latest().onDelta("fresh summary");
      latest().onFinish();
      await flush();

      expect(repo.updateSummaryById).toHaveBeenCalledWith(1, "fresh summary");
      // Nobody is watching, so there is no one to offer the revert to.
      expect(getJob(1)).toBeUndefined();
    });
  });

  describe("flow 2 — finishes on screen with no previous summary", () => {
    it("saves automatically and offers no revert", async () => {
      subscribe(1, jest.fn());

      await startSummary(makePost({ id: 1, summary: undefined }));
      latest().onDelta("brand new");
      latest().onFinish();
      await flush();

      expect(repo.updateSummaryById).toHaveBeenCalledWith(1, "brand new");
      expect(getJob(1)).toBeUndefined();
    });
  });

  describe("flow 3 — finishes on screen over an existing summary", () => {
    it("saves the new summary but keeps the job so it can be undone", async () => {
      subscribe(1, jest.fn());

      await startSummary(makePost({ id: 1, summary: "old summary" }));
      latest().onDelta("new summary");
      latest().onFinish();
      await flush();

      expect(repo.updateSummaryById).toHaveBeenCalledWith(1, "new summary");
      const job = getJob(1);
      expect(job?.status).toBe("committed");
      expect(job?.hadPreviousSummary).toBe(true);
      expect(job?.previousSummary).toBe("old summary");
    });

    it("writes the previous summary back on revert and clears the job", async () => {
      subscribe(1, jest.fn());

      await startSummary(makePost({ id: 1, summary: "old summary" }));
      latest().onDelta("new summary");
      latest().onFinish();
      await flush();

      await revertSummary(1);

      expect(repo.updateSummaryById).toHaveBeenLastCalledWith(1, "old summary");
      expect(getJob(1)).toBeUndefined();
    });

    it("still offers the original text after regenerating twice", async () => {
      subscribe(1, jest.fn());
      const post = makePost({ id: 1, summary: "old summary" });

      await startSummary(post);
      latest().onDelta("attempt one");
      latest().onFinish();
      await flush();

      // The post in hand still carries the stale summary; the job remembers.
      await startSummary(post);
      latest().onDelta("attempt two");
      latest().onFinish();
      await flush();

      expect(getJob(1)?.previousSummary).toBe("old summary");
      await revertSummary(1);
      expect(repo.updateSummaryById).toHaveBeenLastCalledWith(1, "old summary");
    });

    it("ignores a revert once the job is gone", async () => {
      await startSummary(makePost({ id: 1, summary: "old summary" }));
      latest().onFinish();
      await flush();

      await revertSummary(1);

      expect(repo.updateSummaryById).toHaveBeenCalledTimes(1);
    });
  });

  it("commits the partial text when stopped mid-stream", async () => {
    subscribe(1, jest.fn());

    await startSummary(makePost({ id: 1 }));
    latest().onDelta("half a summ");
    stopSummary(1);
    await flush();

    expect(latest().close).toHaveBeenCalled();
    expect(repo.updateSummaryById).toHaveBeenCalledWith(1, "half a summ");
  });

  describe("endpoint failover", () => {
    beforeEach(() => {
      _setDependenciesForTesting({
        loadSettings: async () => ({
          AI_ENDPOINT_URL: "https://one.example.com; https://two.example.com",
          AI_MODEL_ID: "test-model",
        }),
      });
    });

    it("falls through to the next endpoint on error", async () => {
      await startSummary(makePost({ id: 1 }));
      expect(latest().endpoint).toBe("https://one.example.com");

      latest().onError(new Error("boom"));
      expect(streams).toHaveLength(2);
      expect(latest().endpoint).toBe("https://two.example.com");

      latest().onDelta("recovered");
      latest().onFinish();
      await flush();
      expect(repo.updateSummaryById).toHaveBeenCalledWith(1, "recovered");
    });

    it("errors without saving once every endpoint has failed", async () => {
      await startSummary(makePost({ id: 1 }));
      latest().onError(new Error("first down"));
      latest().onError(new Error("second down"));
      await flush();

      const job = getJob(1);
      expect(job?.status).toBe("error");
      expect(job?.error).toContain("All endpoints failed");
      expect(repo.updateSummaryById).not.toHaveBeenCalled();
    });
  });

  it("reports an error when no endpoint is configured", async () => {
    _setDependenciesForTesting({ loadSettings: async () => ({}) });

    await startSummary(makePost({ id: 1 }));

    expect(getJob(1)?.status).toBe("error");
    expect(getJob(1)?.error).toBe("AI Settings Not Configured");
    expect(streams).toHaveLength(0);
  });

  describe("job isolation", () => {
    it("closes the previous stream when a post is restarted", async () => {
      await startSummary(makePost({ id: 1 }));
      const first = latest();
      first.onDelta("stale text");

      await startSummary(makePost({ id: 1 }));

      expect(first.close).toHaveBeenCalled();
      expect(getJob(1)?.text).toBe("");

      // A late delta from the superseded stream must not leak into the new job.
      first.onDelta("more stale text");
      expect(getJob(1)?.text).toBe("");
    });

    it("does not commit a superseded stream's text", async () => {
      await startSummary(makePost({ id: 1 }));
      const first = latest();
      first.onDelta("stale");

      await startSummary(makePost({ id: 1 }));
      first.onFinish();
      await flush();

      expect(repo.updateSummaryById).not.toHaveBeenCalled();
    });

    it("runs jobs for different posts concurrently", async () => {
      await startSummary(makePost({ id: 1 }));
      const streamOne = latest();
      await startSummary(makePost({ id: 2 }));
      const streamTwo = latest();

      streamOne.onDelta("post one");
      streamTwo.onDelta("post two");

      expect(getJob(1)?.text).toBe("post one");
      expect(getJob(2)?.text).toBe("post two");

      streamTwo.onFinish();
      await flush();

      expect(repo.updateSummaryById).toHaveBeenCalledWith(2, "post two");
      expect(getJob(1)?.status).toBe("streaming");
    });
  });

  describe("subscriptions", () => {
    it("unsubscribing removes the listener and is idempotent", async () => {
      const listener = jest.fn();
      const unsubscribe = subscribe(1, listener);
      expect(hasSubscribers(1)).toBe(true);

      unsubscribe();
      unsubscribe();
      expect(hasSubscribers(1)).toBe(false);

      await startSummary(makePost({ id: 1 }));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("clearJob", () => {
    it("drops a finished job but leaves a running one alone", async () => {
      subscribe(1, jest.fn());
      await startSummary(makePost({ id: 1, summary: "old summary" }));

      clearJob(1);
      expect(getJob(1)?.status).toBe("streaming");

      latest().onFinish();
      await flush();
      expect(getJob(1)?.status).toBe("committed");

      clearJob(1);
      expect(getJob(1)).toBeUndefined();
    });
  });
});
