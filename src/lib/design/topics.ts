// System design prompts (spec 4.5, phase 4). Each one carries what the
// interviewer reveals when asked (requirements and scale), what a solid design
// includes, and the deep dives the interviewer can push on. Keyword groups are
// synonyms the scripted interviewer and the rule-based grader look for.
import type { RoundTopic } from "../rounds/kind";

export interface DesignFact {
  /** Words in a clarifying question that this fact answers. */
  keywords: string[];
  answer: string;
}

export interface DesignComponent {
  name: string;
  /** Synonyms found in whiteboard labels or speech. */
  keywords: string[];
  /** Why it's needed; the interviewer's probe when it's missing. */
  probe: string;
  core: boolean;
}

export interface DeepDive {
  id: string;
  title: string;
  question: string;
  /** What a strong answer touches, as synonym groups. */
  keywords: string[][];
  /** A strong answer, in a sentence or two, for the report. */
  strong: string;
}

export interface DesignTopic extends RoundTopic {
  /** The usual level this prompt is asked at. */
  level: "any" | "mid" | "senior";
  /** What the interviewer reads out to open the round. */
  prompt: string;
  functional: string[];
  outOfScope: string[];
  nonFunctional: string[];
  /** Answers to clarifying questions, matched by keyword. */
  facts: DesignFact[];
  /** Back-of-the-envelope numbers that make sense for this prompt. */
  estimates: string[];
  components: DesignComponent[];
  deepDives: DeepDive[];
  tradeoffs: string[];
  companies: string[];
}

const LB = { name: "Load balancer", keywords: ["load balancer", "lb", "balancer", "nginx", "elb", "alb"], probe: "How does traffic get spread across your servers, and what happens when one dies?", core: false };
const CACHE_KW = ["cache", "redis", "memcached", "memcache", "cdn cache"];

export const DESIGN_TOPICS: DesignTopic[] = [
  {
    id: "url-shortener",
    title: "Link shortener",
    summary: "Turn long URLs into short links that redirect, at the scale of a popular public service.",
    level: "any",
    prompt:
      "Let's design a link shortening service. A user pastes a long URL and gets back a short link, and anyone who opens the short link is redirected to the original page. Where would you like to start?",
    functional: ["Create a short link for a long URL", "Redirect a short link to its long URL", "Optional custom aliases", "Links can expire"],
    outOfScope: ["User accounts and dashboards", "Detailed click analytics beyond a simple counter"],
    nonFunctional: ["Redirects are fast (well under 100 ms) and highly available", "Short codes are not guessable in sequence", "Reads far outnumber writes"],
    facts: [
      { keywords: ["users", "traffic", "scale", "how many", "dau", "volume", "qps", "requests"], answer: "Assume 100 million new links a month and about 100 times as many redirects as creations." },
      { keywords: ["read", "write", "ratio"], answer: "Reads dominate: roughly 100 redirects for every link created." },
      { keywords: ["length", "short", "characters", "code"], answer: "Keep the code as short as practical; seven characters or so is fine." },
      { keywords: ["custom", "alias", "vanity"], answer: "Custom aliases are a nice-to-have. Support them if it's easy, but they must not collide." },
      { keywords: ["expire", "expiration", "ttl", "delete", "forever"], answer: "By default links live for five years; users can set a shorter expiry." },
      { keywords: ["analytics", "clicks", "count", "stats"], answer: "Just a click counter per link. Full analytics is out of scope." },
      { keywords: ["latency", "fast", "slow"], answer: "Redirects should feel instant: aim for under 50 milliseconds at the server." },
      { keywords: ["availability", "uptime", "down"], answer: "Redirects must be highly available; creation can tolerate brief hiccups." },
      { keywords: ["same", "duplicate", "again", "twice"], answer: "If the same long URL is shortened twice, returning a new code is fine." },
      { keywords: ["auth", "login", "account", "accounts"], answer: "No accounts for now; anyone can create a link." },
    ],
    estimates: [
      "100M links a month is about 40 writes per second, and about 4,000 redirects per second on average (more at peak).",
      "Five years of links is about 6 billion records; at roughly 500 bytes each that's about 3 TB.",
      "Base62 with 7 characters gives about 3.5 trillion codes, plenty of room.",
    ],
    components: [
      { name: "API / app servers", keywords: ["api", "server", "service", "app server", "web server", "backend", "application"], probe: "What handles the create and redirect requests?", core: true },
      { name: "Database for mappings", keywords: ["database", "db", "dynamo", "dynamodb", "cassandra", "postgres", "mysql", "sql", "nosql", "key value", "kv store", "datastore", "storage"], probe: "Where do the code to URL mappings live, and which kind of store fits that access pattern?", core: true },
      { name: "Cache", keywords: CACHE_KW, probe: "Redirects are 100 times more common than creations. How do you avoid hitting the database on every redirect?", core: true },
      { name: "ID / code generator", keywords: ["id generator", "key generation", "kgs", "counter", "snowflake", "hash", "base62", "base 62", "ticket", "token range", "range"], probe: "How exactly do you generate a short code that's unique?", core: true },
      LB,
      { name: "Analytics pipeline", keywords: ["queue", "kafka", "stream", "analytics", "async", "counter service"], probe: "How do you count clicks without slowing down the redirect?", core: false },
    ],
    deepDives: [
      {
        id: "codegen",
        title: "Generating unique codes",
        question: "Let's go deeper on generating the codes. How do you make sure two servers never hand out the same code, without a bottleneck?",
        keywords: [["counter", "sequence", "auto increment", "ticket"], ["base62", "base 62", "encode", "encoding"], ["range", "ranges", "batch", "block", "pre generate", "pregenerate", "key generation"], ["collision", "collide", "unique", "conflict"], ["zookeeper", "coordination", "snowflake", "machine id", "worker id"]],
        strong: "Hand each server a block of counter values (from a coordinator or a key-generation service) and base62-encode them, so codes are unique without a lock per request; hashing plus collision checks is a fallback, and a random offset avoids guessable sequences.",
      },
      {
        id: "redirect-path",
        title: "The redirect hot path",
        question: "Walk me through exactly what happens when someone opens a short link, and how you keep that path fast at peak.",
        keywords: [["cache", "redis", "memcached"], ["301", "302", "redirect", "status code"], ["cdn", "edge"], ["miss", "cache miss", "fallback", "read through"], ["ttl", "evict", "lru", "eviction"]],
        strong: "Look up the code in a cache (read-through, LRU), fall back to the key-value store on a miss, and answer with a 302 (or 301 if you don't need click counts); popular links can be served from the edge.",
      },
      {
        id: "storage",
        title: "Storage and partitioning",
        question: "You'll have billions of mappings. How do you store and partition them?",
        keywords: [["shard", "sharding", "partition", "partitioning"], ["key value", "nosql", "dynamo", "cassandra"], ["replica", "replication", "replicas"], ["consistent hashing", "hash of the code", "hash the code", "partition key"], ["expire", "expiry", "ttl", "cleanup"]],
        strong: "A key-value store partitioned by the short code (consistent hashing), replicated for availability, with expired links cleaned up lazily on read and by a background job.",
      },
    ],
    tradeoffs: ["Counter ranges vs hashing for code generation", "301 (cacheable, loses click counts) vs 302", "SQL vs a key-value store for a simple lookup", "Synchronous vs asynchronous click counting"],
    companies: ["Google", "Amazon", "Microsoft", "Meta"],
  },
  {
    id: "news-feed",
    title: "Social news feed",
    summary: "Show each user a ranked feed of posts from people they follow, with fresh posts appearing quickly.",
    level: "mid",
    prompt:
      "Design the home feed for a social network. Users follow other users and post short text and photos, and the home feed shows recent posts from the people you follow. How would you approach it?",
    functional: ["Publish a post (text, optional photo)", "Follow and unfollow users", "Home feed of recent posts from followed users, newest or ranked first", "Paginate through the feed"],
    outOfScope: ["Comments, likes and notifications", "Ads", "Search"],
    nonFunctional: ["Feed loads quickly (under 200 ms)", "New posts appear in followers' feeds within seconds to a minute", "Very read heavy", "High availability over strict consistency"],
    facts: [
      { keywords: ["users", "dau", "scale", "how many", "traffic"], answer: "Assume 300 million daily active users." },
      { keywords: ["post", "posts", "write", "writes", "publish"], answer: "Users post about once a day on average." },
      { keywords: ["read", "reads", "open", "views", "refresh"], answer: "Each user opens the feed about ten times a day." },
      { keywords: ["follow", "followers", "following", "celebrity", "celebrities", "famous"], answer: "Most users follow a few hundred accounts; some celebrities have tens of millions of followers." },
      { keywords: ["rank", "ranking", "order", "chronological", "sort"], answer: "Start reverse-chronological; mention how you'd plug in ranking later." },
      { keywords: ["photo", "photos", "image", "images", "media", "video"], answer: "Photos yes, video out of scope. Photos are a few hundred kilobytes each." },
      { keywords: ["latency", "fast"], answer: "The feed should load in under 200 milliseconds." },
      { keywords: ["consistency", "consistent", "delay", "stale", "fresh"], answer: "A short delay before a post shows up for followers is fine; a few seconds is the goal." },
    ],
    estimates: [
      "300M DAU × 10 feed loads is 3 billion reads a day, about 35,000 per second on average.",
      "300M posts a day is about 3,500 writes per second; fan-out multiplies that by followers.",
      "Photo storage: 300M × ~30% with photos × 300 KB is roughly 30 TB a day, so blob storage plus a CDN.",
    ],
    components: [
      { name: "Post service", keywords: ["post service", "write service", "posting", "publish service", "api", "server", "service"], probe: "What handles a new post being published?", core: true },
      { name: "Feed service", keywords: ["feed service", "timeline service", "feed generation", "feed", "timeline"], probe: "What builds and serves the home feed?", core: true },
      { name: "Fan-out workers / queue", keywords: ["fan out", "fanout", "queue", "kafka", "workers", "worker", "async", "pub sub", "pubsub"], probe: "When someone with a million followers posts, what work happens and where?", core: true },
      { name: "Feed cache", keywords: [...CACHE_KW, "timeline cache", "feed cache", "precomputed"], probe: "How do you serve 35,000 feed reads a second quickly?", core: true },
      { name: "Posts and social graph storage", keywords: ["database", "db", "graph", "follow table", "followers table", "cassandra", "postgres", "mysql", "storage"], probe: "Where do posts and the follow graph live?", core: true },
      { name: "Blob storage + CDN", keywords: ["s3", "blob", "object storage", "cdn", "media storage"], probe: "Where do photos go and how are they served?", core: false },
      LB,
    ],
    deepDives: [
      {
        id: "fanout",
        title: "Fan-out on write vs read",
        question: "Let's dig into fan-out. Do you push posts into followers' feeds when they're written, or pull at read time? What about celebrities?",
        keywords: [["fan out on write", "push", "write time", "precompute", "precomputed"], ["fan out on read", "pull", "read time", "on demand"], ["celebrity", "celebrities", "hybrid", "famous", "high follower"], ["queue", "async", "workers", "background"]],
        strong: "Hybrid: push post ids into followers' cached timelines asynchronously for normal accounts, and merge celebrity posts in at read time, so neither writes nor reads explode.",
      },
      {
        id: "feed-storage",
        title: "Storing and paginating feeds",
        question: "How do you store each user's feed and paginate through it?",
        keywords: [["cursor", "pagination", "paginate", "page token", "offset"], ["redis", "cache", "sorted set", "list"], ["post id", "ids only", "id list", "references"], ["limit", "cap", "trim", "last n", "recent"], ["hydrate", "hydration", "fetch posts", "batch get", "multi get"]],
        strong: "Keep a capped list of recent post ids per user in a cache (e.g. a Redis sorted set by time), page with a cursor (last seen id or timestamp), and hydrate post bodies in a batch from the post store.",
      },
      {
        id: "ranking",
        title: "Ranking",
        question: "Product now wants a ranked feed rather than pure chronology. How would that change your design?",
        keywords: [["rank", "ranking", "score", "scoring"], ["features", "signals", "engagement"], ["model", "ml", "machine learning"], ["candidate", "candidates", "retrieve", "retrieval"], ["offline", "online", "precompute", "real time"]],
        strong: "Two stages: gather a few hundred candidate posts from the timeline, then score them with a model on engagement signals at read time, with features precomputed offline and cached.",
      },
    ],
    tradeoffs: ["Push vs pull fan-out (and the hybrid)", "Freshness vs read latency", "Storing ids vs full posts in the feed cache", "Chronological vs ranked feeds"],
    companies: ["Meta", "Google", "Amazon", "Apple"],
  },
  {
    id: "chat",
    title: "Chat messaging",
    summary: "One-to-one and small group chat with real-time delivery, history and online status.",
    level: "mid",
    prompt:
      "Let's design a chat app like the messaging products you use every day: one-to-one and small group conversations, messages delivered in real time, and history that syncs across devices. Where do you want to start?",
    functional: ["Send and receive one-to-one messages in real time", "Group chats up to 100 members", "Message history synced across a user's devices", "Delivered and read receipts", "Online / last seen status"],
    outOfScope: ["Voice and video calls", "End-to-end encryption details (mention it, don't design it)", "Large broadcast channels"],
    nonFunctional: ["Low delivery latency (under a second)", "Messages are never lost and arrive in order within a conversation", "Works on flaky mobile networks", "High availability"],
    facts: [
      { keywords: ["users", "dau", "scale", "how many"], answer: "Assume 500 million daily active users." },
      { keywords: ["messages", "volume", "per day", "send"], answer: "About 40 messages per user per day." },
      { keywords: ["group", "groups", "members", "size"], answer: "Groups up to 100 members." },
      { keywords: ["history", "retention", "store", "forever", "keep"], answer: "Keep history indefinitely and sync it to new devices." },
      { keywords: ["offline", "push", "notification", "notifications"], answer: "If the recipient is offline, they get a push notification and the message waits for them." },
      { keywords: ["order", "ordering"], answer: "Messages must appear in the same order for everyone in a conversation." },
      { keywords: ["media", "image", "images", "photo", "files", "attachments"], answer: "Images and files are supported; assume they go to separate storage." },
      { keywords: ["encryption", "e2e", "end to end", "secure"], answer: "Assume transport encryption; end-to-end encryption is out of scope for today." },
      { keywords: ["devices", "multiple devices", "phone", "laptop"], answer: "A user can be logged in on a phone and a laptop at the same time." },
    ],
    estimates: [
      "500M × 40 messages is 20 billion messages a day, about 230,000 per second on average.",
      "At ~200 bytes per message that's about 4 TB of new message data per day before replication.",
      "Hundreds of millions of concurrent persistent connections: tens of thousands of connection servers.",
    ],
    components: [
      { name: "Connection / gateway servers", keywords: ["websocket", "websockets", "web socket", "gateway", "connection server", "chat server", "persistent connection", "long poll", "long polling", "mqtt"], probe: "How do messages reach a phone in real time? What kind of connection is open?", core: true },
      { name: "Message service", keywords: ["message service", "chat service", "messaging service", "service", "api"], probe: "What accepts a message and decides where it goes?", core: true },
      { name: "Message store", keywords: ["database", "db", "cassandra", "hbase", "message store", "storage", "dynamo", "bigtable"], probe: "Where is message history stored, and how is it keyed?", core: true },
      { name: "Session / presence registry", keywords: ["presence", "session", "registry", "redis", "which server", "routing table", "online status", "heartbeat"], probe: "When I send you a message, how does the system know which connection server you're on?", core: true },
      { name: "Queue / inbox for offline delivery", keywords: ["queue", "kafka", "inbox", "offline", "pending"], probe: "What happens to a message when the recipient is offline?", core: false },
      { name: "Push notification service", keywords: ["push", "apns", "fcm", "notification"], probe: "How does an offline user find out they have a message?", core: false },
      LB,
    ],
    deepDives: [
      {
        id: "delivery",
        title: "Real-time delivery and routing",
        question: "Walk me through a message from my phone to yours, including when you're on a different server or offline.",
        keywords: [["websocket", "persistent connection", "connection"], ["registry", "presence", "which server", "lookup", "session store"], ["ack", "acknowledge", "acknowledgement", "delivered"], ["offline", "push", "notification", "inbox"], ["retry", "retries", "resend", "idempotent", "dedupe", "deduplicate"]],
        strong: "Sender's gateway hands the message to the chat service, which persists it, looks up the recipient's gateway in a presence registry and forwards it; the client acks; if offline, it waits in an inbox and a push notification goes out. Client message ids make retries idempotent.",
      },
      {
        id: "ordering",
        title: "Ordering and history storage",
        question: "How do you keep messages ordered within a conversation and store history efficiently?",
        keywords: [["sequence", "sequence number", "monotonic", "counter"], ["conversation id", "partition", "partition key", "chat id", "channel id"], ["timestamp", "clock", "clock skew"], ["cassandra", "wide column", "hbase", "bigtable"], ["sync", "cursor", "last seen", "since"]],
        strong: "Partition by conversation id and give each message a per-conversation sequence number assigned by the server (not client clocks); store in a wide-column store keyed by (conversation, sequence) and sync devices from their last seen sequence.",
      },
      {
        id: "groups",
        title: "Group chat fan-out",
        question: "Now groups of up to 100. How does a group message reach everyone, and what changes in storage?",
        keywords: [["fan out", "fanout", "each member", "per member"], ["store once", "single copy", "one copy"], ["queue", "async", "workers"], ["receipts", "read receipts", "delivered"]],
        strong: "Store the message once per group, then fan out delivery to each member's connection (or inbox) asynchronously; receipts are aggregated per member rather than per message copy.",
      },
    ],
    tradeoffs: ["WebSockets vs long polling", "Server-assigned sequence numbers vs timestamps", "Store-once vs copy-per-recipient for groups", "Delivery guarantees vs latency (at-least-once with dedupe)"],
    companies: ["Meta", "Microsoft", "Google", "Apple"],
  },
  {
    id: "rate-limiter",
    title: "API rate limiter",
    summary: "Limit how many requests each client can make across a fleet of API servers.",
    level: "any",
    prompt:
      "Design a rate limiter for a public API. Each client should be limited to some number of requests per time window, and the API runs on many servers behind a load balancer. How would you start?",
    functional: ["Limit requests per client (API key or user) per time window", "Different limits per endpoint or plan", "Return a clear error (429) with retry information when limited"],
    outOfScope: ["Billing", "DDoS protection at the network layer"],
    nonFunctional: ["Adds very little latency (a millisecond or two)", "Accurate enough across many servers", "If the limiter fails, the API keeps working (fail open)", "Highly available"],
    facts: [
      { keywords: ["scale", "how many", "traffic", "qps", "requests"], answer: "About a million requests per second across the API at peak." },
      { keywords: ["clients", "keys", "users", "how many clients"], answer: "Around 10 million API keys." },
      { keywords: ["limit", "limits", "rules", "window"], answer: "Typical rules: 100 requests per minute per key, with higher limits for paid plans and some per-endpoint limits." },
      { keywords: ["accurate", "accuracy", "exact", "precise", "strict"], answer: "Approximately right is fine; letting a few extra requests through at the window edge is acceptable." },
      { keywords: ["where", "middleware", "gateway", "client side"], answer: "It's your call where it runs; we control the API gateway and the servers." },
      { keywords: ["fail", "failure", "down", "outage"], answer: "If the limiter is down, prefer letting traffic through rather than blocking everyone." },
      { keywords: ["latency"], answer: "Budget about a millisecond of added latency." },
      { keywords: ["distributed", "servers", "multiple servers", "many servers"], answer: "Yes, there are hundreds of API servers in several regions." },
    ],
    estimates: [
      "1M requests per second means 1M counter checks per second; a single Redis node handles ~100k ops/s, so shard across ~10-20 nodes.",
      "10M keys × a few counters × ~50 bytes is well under 10 GB of state: fits in memory.",
    ],
    components: [
      { name: "Limiter middleware / gateway", keywords: ["middleware", "gateway", "api gateway", "interceptor", "filter", "proxy", "sidecar"], probe: "Where in the request path does the check happen?", core: true },
      { name: "Shared counter store", keywords: ["redis", "memcached", "counter store", "cache", "in memory store", "centralized store", "shared store"], probe: "With hundreds of servers, where do the counts live so they're shared?", core: true },
      { name: "Rules configuration", keywords: ["rules", "config", "configuration", "rules engine", "policy", "policies"], probe: "Where do the per-plan and per-endpoint limits come from, and how do they change?", core: true },
      { name: "Algorithm", keywords: ["token bucket", "leaky bucket", "sliding window", "fixed window", "sliding log", "window counter"], probe: "Which rate limiting algorithm are you using exactly?", core: true },
      LB,
    ],
    deepDives: [
      {
        id: "algorithm",
        title: "Choosing the algorithm",
        question: "Let's go deep on the algorithm. Which one, how does it work step by step, and what are its weaknesses?",
        keywords: [["token bucket", "tokens", "refill"], ["sliding window", "sliding log", "weighted"], ["fixed window", "boundary", "burst", "edge of the window"], ["memory", "per key", "space"]],
        strong: "Token bucket (refill rate and burst size per key) or a sliding window counter that weights the previous window; both avoid fixed-window edge bursts with O(1) state per key.",
      },
      {
        id: "distributed",
        title: "Counting across many servers",
        question: "How do you keep counts correct across hundreds of servers without adding much latency?",
        keywords: [["redis", "central", "shared", "centralized"], ["atomic", "lua", "incr", "increment", "transaction", "race"], ["local", "in memory", "batch", "sync", "approximate"], ["shard", "sharding", "partition", "consistent hashing"], ["fail open", "fallback", "timeout"]],
        strong: "Atomic increments in a sharded Redis (a Lua script for check-and-increment) keyed by client; optionally local counters synced in small batches for lower latency at some accuracy cost; short timeouts and fail open.",
      },
      {
        id: "client",
        title: "Client experience",
        question: "What does a limited client see, and how do you help well-behaved clients stay under the limit?",
        keywords: [["429", "too many requests"], ["retry after", "retry-after", "header", "headers"], ["remaining", "x ratelimit", "ratelimit remaining", "limit header"], ["backoff", "exponential", "jitter"]],
        strong: "Return 429 with Retry-After and rate-limit headers (limit, remaining, reset) on every response so clients can back off with jitter before hitting the wall.",
      },
    ],
    tradeoffs: ["Accuracy vs latency (central store vs local counters)", "Token bucket vs sliding window", "Fail open vs fail closed", "Gateway vs in-service enforcement"],
    companies: ["Amazon", "Google", "Microsoft", "Stripe"],
  },
  {
    id: "notifications",
    title: "Notification system",
    summary: "Send push, email and SMS notifications reliably for many internal services.",
    level: "mid",
    prompt:
      "Design a notification service that other teams' services call to notify users by push notification, email or SMS. It should respect user preferences and be reliable. Where would you start?",
    functional: ["Internal services send a notification for a user, by channel or letting us choose", "Push, email and SMS channels", "Respect user preferences and opt-outs", "Templates", "Scheduled and immediate sends"],
    outOfScope: ["Building the actual SMS or email gateway (use providers)", "Marketing campaign tooling"],
    nonFunctional: ["Reliable: no lost notifications, no duplicates the user notices", "Most notifications go out within seconds", "Handles spikes (a big event sends millions at once)", "Third-party providers can be slow or down"],
    facts: [
      { keywords: ["scale", "how many", "volume", "per day"], answer: "About 50 million notifications a day, with spikes of a few million in a few minutes." },
      { keywords: ["channels", "push", "email", "sms"], answer: "Push, email and SMS; push is about 70% of volume." },
      { keywords: ["priority", "urgent", "otp", "important"], answer: "Some are urgent, like one-time passcodes; others, like a weekly digest, can wait." },
      { keywords: ["preferences", "opt out", "unsubscribe", "settings"], answer: "Users can opt out per channel and per notification type, and set quiet hours." },
      { keywords: ["duplicate", "duplicates", "twice", "exactly once"], answer: "Duplicates are bad, especially SMS that costs money; avoid them." },
      { keywords: ["provider", "providers", "third party", "vendor", "twilio", "sendgrid"], answer: "We use external providers (for example APNs, FCM, an email provider, an SMS provider)." },
      { keywords: ["tracking", "track", "status", "delivered", "open"], answer: "Track sent and delivered status; opens are a nice-to-have." },
    ],
    estimates: [
      "50M a day is ~600 per second average; spikes of 3M in 5 minutes are ~10,000 per second.",
      "Notification records at ~1 KB each: 50 GB a day, so keep detailed logs for a limited time.",
    ],
    components: [
      { name: "Notification API", keywords: ["api", "notification service", "service", "server"], probe: "What do other services call, and what does that request contain?", core: true },
      { name: "Message queue", keywords: ["queue", "kafka", "sqs", "rabbitmq", "pub sub", "pubsub", "topic"], probe: "A spike of three million notifications arrives. What absorbs it?", core: true },
      { name: "Channel workers", keywords: ["worker", "workers", "consumer", "consumers", "sender", "senders", "dispatcher"], probe: "What actually talks to the push, email and SMS providers?", core: true },
      { name: "Preferences / user store", keywords: ["preferences", "user settings", "opt out", "user db", "settings", "database", "db"], probe: "Where do you check whether the user wants this notification at all?", core: true },
      { name: "Templates", keywords: ["template", "templates", "templating"], probe: "Where does the actual text of a notification come from?", core: false },
      { name: "Notification log / status store", keywords: ["log", "status", "tracking", "notification log", "history", "audit"], probe: "How would you answer 'did this user get the notification?'", core: false },
      { name: "Retry / dead-letter queue", keywords: ["retry", "retries", "dead letter", "dlq", "backoff"], probe: "What happens when a provider times out?", core: false },
    ],
    deepDives: [
      {
        id: "reliability",
        title: "Reliability and duplicates",
        question: "Let's go deep on reliability. How do you make sure nothing is lost and nothing is sent twice when workers crash and providers time out?",
        keywords: [["idempotent", "idempotency", "dedupe", "deduplicate", "dedup", "unique id"], ["retry", "retries", "backoff", "exponential"], ["dead letter", "dlq"], ["at least once", "ack", "acknowledge", "commit offset"], ["persist", "durable", "write ahead", "outbox"]],
        strong: "Durable queue with at-least-once delivery, an idempotency key per notification checked before sending, retries with exponential backoff, and a dead-letter queue after N failures.",
      },
      {
        id: "priority",
        title: "Priorities and spikes",
        question: "An OTP code must arrive in seconds even while a three million notification digest is going out. How?",
        keywords: [["priority", "priorities", "separate queue", "separate queues", "high priority"], ["rate limit", "throttle", "throttling"], ["autoscale", "autoscaling", "scale workers", "more workers"], ["per channel", "per provider", "channel queue"]],
        strong: "Separate queues (or partitions) by priority and channel, dedicated workers for urgent traffic, throttling bulk sends to provider rate limits, and autoscaling workers on queue depth.",
      },
      {
        id: "preferences",
        title: "Preferences and quiet hours",
        question: "How do preferences, opt-outs and quiet hours fit into the flow, and where would you cache them?",
        keywords: [["cache", "redis"], ["quiet hours", "time zone", "timezone", "schedule", "delay"], ["opt out", "unsubscribe", "preferences"], ["before", "check", "filter"]],
        strong: "Check preferences (cached) before enqueuing per channel; defer non-urgent sends that fall in quiet hours using the user's time zone via a scheduler; urgent ones bypass.",
      },
    ],
    tradeoffs: ["At-least-once plus dedupe vs exactly-once", "One queue vs per-priority/channel queues", "Checking preferences before vs after queueing", "Storing full logs vs sampling"],
    companies: ["Amazon", "Meta", "Uber", "Microsoft"],
  },
  {
    id: "ride-matching",
    title: "Ride-hailing dispatch",
    summary: "Match riders with nearby drivers in real time using constantly updating locations.",
    level: "senior",
    prompt:
      "Design the core of a ride-hailing service: drivers' phones report their location every few seconds, a rider requests a ride, and we match them with a nearby available driver. How would you approach it?",
    functional: ["Drivers report location every few seconds", "Riders request a ride from their location", "Match with a nearby available driver who accepts", "Both see each other's live location during the trip"],
    outOfScope: ["Payments", "Pricing and surge details", "Ratings"],
    nonFunctional: ["Matching within a few seconds", "Location updates are high volume but individually unimportant", "A driver is never assigned two rides", "Regional: most traffic is local to a city"],
    facts: [
      { keywords: ["drivers", "how many drivers", "active drivers"], answer: "About 1 million drivers online at peak worldwide." },
      { keywords: ["riders", "users", "rides", "requests", "how many", "scale"], answer: "Around 20 million rides a day." },
      { keywords: ["location", "update", "frequency", "often", "seconds"], answer: "Drivers send a location update every 4 seconds." },
      { keywords: ["radius", "nearby", "distance", "how close"], answer: "Look for drivers within a few kilometers, expanding if none accept." },
      { keywords: ["accept", "decline", "timeout", "reject"], answer: "A driver has 10 seconds to accept; if they decline or time out, try the next one." },
      { keywords: ["consistency", "double", "two riders", "assigned twice"], answer: "A driver must never be assigned to two riders at once." },
      { keywords: ["region", "regions", "global", "cities", "city"], answer: "It's global, but each trip happens within one city." },
    ],
    estimates: [
      "1M drivers / 4 s = 250,000 location writes per second at peak.",
      "20M rides a day is ~230 ride requests per second on average, maybe 1,000+ at peak.",
      "Current locations: 1M × ~100 bytes = 100 MB, small enough to keep in memory per region.",
    ],
    components: [
      { name: "Location service", keywords: ["location service", "location", "gps", "tracking service", "ingest"], probe: "Where do the 250,000 location updates a second go?", core: true },
      { name: "Geospatial index", keywords: ["geohash", "quadtree", "s2", "h3", "geospatial", "spatial index", "grid", "geo index", "redis geo"], probe: "Given a rider's location, how do you find nearby drivers quickly?", core: true },
      { name: "Matching / dispatch service", keywords: ["matching", "dispatch", "match service", "matcher", "dispatcher"], probe: "What decides which driver gets which ride?", core: true },
      { name: "Trip service and database", keywords: ["trip service", "ride service", "trip", "database", "db", "postgres", "mysql"], probe: "Where do trips and their state live?", core: true },
      { name: "Real-time connection to phones", keywords: ["websocket", "websockets", "push", "persistent connection", "gateway", "long poll"], probe: "How does a driver's phone get the ride offer immediately?", core: false },
      { name: "Message queue / stream", keywords: ["queue", "kafka", "stream", "streaming"], probe: "How do location updates reach everything that needs them?", core: false },
    ],
    deepDives: [
      {
        id: "geo",
        title: "Finding nearby drivers",
        question: "Let's go deep on the geospatial part. How do you index constantly moving drivers and query nearby ones fast?",
        keywords: [["geohash", "s2", "h3", "quadtree", "grid", "cell", "cells"], ["in memory", "redis", "memory"], ["neighbor", "neighbors", "adjacent", "surrounding", "expand"], ["update", "move", "remove", "stale", "ttl"], ["shard", "partition", "region", "city"]],
        strong: "Bucket drivers into geohash/H3 cells in an in-memory index sharded by region; on each update move the driver between cells (with a TTL for stale drivers); query the rider's cell plus neighbors and expand the ring if needed.",
      },
      {
        id: "assignment",
        title: "Assignment without double-booking",
        question: "Two riders' requests could pick the same driver at the same moment. How do you prevent double assignment?",
        keywords: [["lock", "locking", "lease", "reserve", "reservation"], ["atomic", "compare and set", "compare and swap", "cas", "transaction", "conditional write"], ["timeout", "expire", "ttl", "10 seconds"], ["state machine", "status", "available", "state"]],
        strong: "Driver availability as a state machine updated atomically (compare-and-set or a short lease with a TTL) when offering a ride; if the driver declines or the lease expires, the driver is released and the next candidate is offered.",
      },
      {
        id: "ingest",
        title: "Ingesting location updates",
        question: "250,000 location writes a second, mostly throwaway. How do you ingest and store them?",
        keywords: [["in memory", "memory", "redis"], ["stream", "kafka", "queue"], ["batch", "batching", "sample", "downsample"], ["history", "trip", "archive", "cold storage", "only during trips"]],
        strong: "Write only the latest position to the in-memory geo index; stream updates through Kafka for consumers; persist full traces only during trips (batched to cheap storage), not every idle ping.",
      },
    ],
    tradeoffs: ["Geohash vs quadtree vs H3 cells", "Consistency of assignment vs matching speed", "Keeping location history vs only the latest point", "Regional isolation vs global services"],
    companies: ["Uber", "Lyft", "Amazon", "Google"],
  },
  {
    id: "file-sync",
    title: "Cloud file storage and sync",
    summary: "Store users' files in the cloud and keep them in sync across devices.",
    level: "senior",
    prompt:
      "Design a cloud file storage and sync service. Users put files in a folder on their laptop and they're backed up and synced to their other devices, with sharing. How would you begin?",
    functional: ["Upload and download files of any size", "Sync changes across a user's devices automatically", "Share files and folders with others", "Keep previous versions of files"],
    outOfScope: ["Real-time collaborative editing", "Search inside documents"],
    nonFunctional: ["Never lose data (very high durability)", "Large files upload reliably over flaky connections", "Sync quickly, but eventual consistency across devices is fine", "Minimize bandwidth and storage"],
    facts: [
      { keywords: ["users", "dau", "scale", "how many"], answer: "Assume 50 million daily active users and 500 million total." },
      { keywords: ["file size", "size", "large", "big", "max"], answer: "Files average a few hundred kilobytes, but some are many gigabytes. Allow up to 50 GB." },
      { keywords: ["storage", "how much", "quota"], answer: "Each user gets 15 GB free; average use is around 2 GB." },
      { keywords: ["versions", "version", "history"], answer: "Keep versions for 30 days." },
      { keywords: ["conflict", "conflicts", "same time", "simultaneous", "concurrent"], answer: "If two devices edit the same file offline, keep both versions as a conflicted copy." },
      { keywords: ["devices", "how many devices"], answer: "Users have two or three devices on average." },
      { keywords: ["share", "sharing", "permissions"], answer: "Sharing with view or edit permission, to specific users or by link." },
    ],
    estimates: [
      "500M users × 2 GB = 1 exabyte of logical data; deduplication and compression matter.",
      "If 50M DAU each change ~5 files a day, that's 250M file updates a day, about 3,000 per second.",
      "Chunking at ~4 MB means a 1 GB file is 250 chunks, each retried independently.",
    ],
    components: [
      { name: "Client sync agent", keywords: ["client", "sync client", "desktop app", "agent", "watcher", "file watcher"], probe: "What runs on the laptop, and how does it notice a change?", core: true },
      { name: "Block / chunk storage", keywords: ["s3", "blob", "object storage", "chunk", "chunks", "block storage", "blocks"], probe: "Where do file contents actually go, and in what units?", core: true },
      { name: "Metadata service and database", keywords: ["metadata", "metadata db", "metadata service", "database", "db", "file table", "postgres", "mysql"], probe: "Where do file names, folders, versions and chunk lists live?", core: true },
      { name: "Sync / notification service", keywords: ["notification", "notify", "sync service", "long poll", "long polling", "websocket", "push", "change feed"], probe: "How does my phone find out that my laptop changed a file?", core: true },
      { name: "Upload / API service", keywords: ["upload service", "api", "server", "service", "presigned", "pre signed"], probe: "How does an upload flow from the client into storage?", core: false },
      { name: "Queue", keywords: ["queue", "kafka", "pub sub"], probe: "How are change events delivered to every device that needs them?", core: false },
    ],
    deepDives: [
      {
        id: "chunking",
        title: "Chunking, dedupe and resumable uploads",
        question: "Let's go deep on uploads. How do you handle a 10 gigabyte file over a flaky connection, and avoid re-uploading what hasn't changed?",
        keywords: [["chunk", "chunks", "block", "blocks", "split"], ["hash", "fingerprint", "checksum", "sha", "content addressed"], ["dedupe", "deduplicate", "deduplication", "dedup"], ["resume", "resumable", "retry", "retries"], ["delta", "diff", "only changed", "changed chunks"]],
        strong: "Split files into ~4 MB chunks named by content hash; upload only chunks the server doesn't already have (dedupe across versions and users), each resumable and retried independently; a file version is just a list of chunk hashes.",
      },
      {
        id: "sync",
        title: "Syncing changes and conflicts",
        question: "How do other devices learn about a change, and what happens when two devices edit the same file offline?",
        keywords: [["long poll", "long polling", "websocket", "push", "notification"], ["cursor", "version", "journal", "change log", "sequence"], ["conflict", "conflicted copy", "both versions"], ["metadata", "commit"], ["offline", "reconnect"]],
        strong: "Each namespace has an ordered change journal; devices hold a cursor and get notified (long poll or push) to fetch changes since it; a commit is accepted only against the latest version, otherwise the loser becomes a conflicted copy.",
      },
      {
        id: "metadata",
        title: "Metadata at scale",
        question: "The metadata database holds billions of files and folders. How do you scale it while keeping folder operations consistent?",
        keywords: [["shard", "sharding", "partition"], ["user id", "namespace", "account", "per user"], ["transaction", "transactions", "acid", "consistent", "consistency"], ["cache", "caching"], ["replica", "replication", "read replica"]],
        strong: "Shard metadata by namespace (user or shared folder) so a folder's operations stay in one shard with transactions; cache hot metadata, read replicas for listing, and keep blobs entirely out of the metadata store.",
      },
    ],
    tradeoffs: ["Chunk size (dedupe vs overhead)", "Strong consistency for metadata vs eventual for device sync", "Long polling vs persistent push", "Cross-user dedupe vs privacy"],
    companies: ["Dropbox", "Google", "Microsoft", "Apple"],
  },
  {
    id: "typeahead",
    title: "Search autocomplete",
    summary: "Suggest top completions as the user types into a search box, with low latency.",
    level: "any",
    prompt:
      "Design search autocomplete: as a user types into a search box, show the top five suggested queries for what they've typed so far. How would you approach it?",
    functional: ["Return the top 5 suggestions for a prefix", "Suggestions ranked by popularity", "Update popularity from recent searches", "Filter offensive suggestions"],
    outOfScope: ["Spelling correction", "Personalization (mention, don't design)", "The search results page itself"],
    nonFunctional: ["Very low latency: under 100 ms end to end, as the user types", "Very read heavy", "Popularity can lag by an hour or so", "Highly available"],
    facts: [
      { keywords: ["users", "scale", "how many", "dau", "traffic"], answer: "Assume 100 million daily users doing about 10 searches each." },
      { keywords: ["keystroke", "each letter", "every character", "requests"], answer: "Clients request suggestions as you type, with a little debouncing; assume one request per character." },
      { keywords: ["fresh", "freshness", "trending", "real time", "update"], answer: "Updating popularity hourly is fine; trending topics within an hour is a bonus." },
      { keywords: ["language", "languages", "english", "unicode"], answer: "English only for now." },
      { keywords: ["personal", "personalized", "personalization", "history"], answer: "No personalization today." },
      { keywords: ["latency", "fast"], answer: "Under 100 milliseconds as the user types." },
      { keywords: ["offensive", "filter", "filtering", "blocklist"], answer: "Never suggest anything on a blocklist." },
    ],
    estimates: [
      "1B searches a day × ~20 characters ≈ 20B suggestion requests a day, about 230,000 per second.",
      "Distinct queries with meaningful counts: maybe a few hundred million; a trie with top-5 per node fits in tens of GB, shardable.",
    ],
    components: [
      { name: "Suggestion service", keywords: ["suggestion service", "autocomplete service", "query service", "api", "service", "server"], probe: "What answers a prefix request?", core: true },
      { name: "Trie / prefix index", keywords: ["trie", "prefix tree", "prefix index", "prefix", "index"], probe: "What data structure answers 'top five for this prefix' quickly?", core: true },
      { name: "Data collection / logging", keywords: ["log", "logs", "logging", "analytics", "kafka", "stream", "collector"], probe: "Where does popularity come from?", core: true },
      { name: "Aggregation / build pipeline", keywords: ["aggregate", "aggregation", "batch", "spark", "mapreduce", "offline", "pipeline", "builder", "build"], probe: "How do raw searches turn into an updated index?", core: true },
      { name: "Cache / CDN", keywords: [...CACHE_KW, "browser cache"], probe: "Most prefixes are requested over and over. How do you exploit that?", core: false },
      LB,
    ],
    deepDives: [
      {
        id: "trie",
        title: "The prefix index",
        question: "Let's go deep on the index. How is it structured so a prefix lookup returns the top five in a few milliseconds?",
        keywords: [["trie", "prefix tree"], ["top k", "top 5", "top five", "precompute", "precomputed", "store at each node", "cached at each node"], ["memory", "in memory"], ["shard", "sharding", "partition", "by prefix", "first letter", "first character"], ["replica", "replicas", "replication"]],
        strong: "An in-memory trie where each node stores its precomputed top five completions, so a lookup is O(prefix length); sharded by prefix range with replicas, and rebuilt offline rather than updated in place.",
      },
      {
        id: "pipeline",
        title: "Updating popularity",
        question: "How do new searches flow into the suggestions, and how often?",
        keywords: [["log", "logs", "stream", "kafka"], ["aggregate", "aggregation", "count", "counts"], ["batch", "hourly", "periodic", "offline", "rebuild"], ["swap", "snapshot", "versioned", "blue green", "atomic"], ["sample", "sampling", "decay", "recency", "weight"]],
        strong: "Log searches to a stream, aggregate counts (with time decay) in hourly batch jobs, build a new trie snapshot offline and atomically swap it in on the serving fleet.",
      },
      {
        id: "latency",
        title: "Keeping it under 100 ms",
        question: "Where does latency come from end to end, and what would you do on the client and the network side?",
        keywords: [["debounce", "debouncing", "throttle"], ["browser cache", "client cache", "local cache", "cache"], ["cdn", "edge"], ["prefetch", "prefetching"], ["http2", "keep alive", "connection reuse"]],
        strong: "Debounce keystrokes, cache responses in the browser and at the edge (popular prefixes are highly cacheable), prefetch the next likely prefixes, and keep the service itself to a single in-memory lookup.",
      },
    ],
    tradeoffs: ["Precomputed top-k per node (fast, more memory) vs computing at query time", "Freshness vs rebuild cost", "Caching at the edge vs personalization", "Sharding by prefix vs hashing (hot spots)"],
    companies: ["Google", "Amazon", "Microsoft", "LinkedIn"],
  },
];

export const DESIGN_TOPIC_BY_ID = new Map(DESIGN_TOPICS.map((t) => [t.id, t]));
