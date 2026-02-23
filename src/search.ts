import { Client, type Schemas } from "@xdevplatform/xdk";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SearchParams {
  queries: string[];
  days: number;
  max: number;
  lang: string;
  raw: boolean;
  posts: boolean;
}

export interface NewsResult {
  id: string;
  headline: string;
  summary: string;
  hook: string;
  category: string;
  keywords: string[];
  updatedAt: string;
}

export interface PostResult {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  verified: boolean;
  createdAt: string;
  likes: number;
  reposts: number;
  replies: number;
  url: string;
}

export interface SearchOutput {
  query: string;
  news: NewsResult[];
  posts: PostResult[];
  errors: string[];
}

// ─── Client ──────────────────────────────────────────────────────────────────

export function createClient(apiKey: string): Client {
  return new Client({ bearerToken: apiKey });
}

// ─── Query builder ───────────────────────────────────────────────────────────
//
// Combines multiple search terms with OR into a single query string.
// When --raw is false (default), appends professional filters to cut noise
// and maximize the quality of each returned result (since you pay per result).

export function buildPostQuery(
  queries: string[],
  lang: string,
  raw: boolean
): string {
  // Combine all search terms with OR for a single API call
  const combined =
    queries.length === 1
      ? queries[0]
      : queries.map((q) => `(${q})`).join(" OR ");

  if (raw) return combined;

  // Professional filters — these are applied server-side and do NOT cost extra.
  // They prevent garbage results from eating your credits.
  const filters = [
    "-is:retweet", // skip retweets — we want original content only
    "-is:reply", // skip replies — top-level posts only
    "has:links", // must contain a URL — signals actual news sharing
    `-is:nullcast`, // skip promoted-only tweets
    `lang:${lang}`, // language filter
  ];

  return `${combined} ${filters.join(" ")}`;
}

// Combine multiple queries with OR for the news endpoint too
export function buildNewsQuery(queries: string[]): string {
  return queries.join(" OR ");
}

// ─── News search ─────────────────────────────────────────────────────────────

export async function searchNews(
  client: Client,
  params: SearchParams
): Promise<SearchOutput> {
  const errors: string[] = [];
  const news: NewsResult[] = [];
  const posts: PostResult[] = [];

  // 1. Search via the dedicated News endpoint (purpose-built for news stories)
  try {
    const newsQuery = buildNewsQuery(params.queries);
    const maxAgeHours = params.days * 24;

    const newsResponse = await client.news.search(newsQuery, {
      maxResults: params.max,
      maxAgeHours,
    });

    if (newsResponse.errors && newsResponse.errors.length > 0) {
      for (const err of newsResponse.errors) {
        errors.push(`News API error: ${JSON.stringify(err)}`);
      }
    }

    if (newsResponse.data) {
      for (const story of newsResponse.data) {
        news.push({
          id: story.restId ?? "",
          headline: story.name ?? "",
          summary: story.summary ?? "",
          hook: story.hook ?? "",
          category: story.category ?? "",
          keywords: story.keywords ?? [],
          updatedAt: story.lastUpdatedAtMs
            ? new Date(Number(story.lastUpdatedAtMs)).toISOString()
            : "",
        });
      }
    }
  } catch (err: any) {
    errors.push(
      `News search failed: ${err?.message ?? String(err)}. Falling back to post search.`
    );
  }

  // 2. If --posts flag is set, or news returned nothing, also search posts
  if (params.posts || news.length === 0) {
    try {
      const postQuery = buildPostQuery(
        params.queries,
        params.lang,
        params.raw
      );
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - params.days);

      const postResponse = await client.posts.searchRecent(postQuery, {
        startTime: startTime.toISOString(),
        maxResults: params.max,
        sortOrder: "relevancy",
        tweetFields: [
          "created_at",
          "author_id",
          "public_metrics",
          "source",
          "entities",
        ],
        userFields: ["name", "username", "verified", "profile_image_url"],
        expansions: ["author_id"],
      });

      if (postResponse.errors && postResponse.errors.length > 0) {
        for (const err of postResponse.errors) {
          errors.push(`Posts API error: ${JSON.stringify(err)}`);
        }
      }

      // Build a user lookup map from includes
      const userMap = new Map<
        string,
        { name: string; username: string; verified: boolean }
      >();
      const includes = postResponse.includes as
        | { users?: Schemas.User[] }
        | undefined;
      if (includes?.users) {
        for (const user of includes.users) {
          userMap.set(user.id, {
            name: user.name,
            username: user.username,
            verified: user.verified ?? false,
          });
        }
      }

      if (postResponse.data) {
        for (const tweet of postResponse.data) {
          const tweetId = tweet.id ?? "";
          const authorId = tweet.authorId ?? "";
          const user = userMap.get(authorId);
          const metrics = tweet.publicMetrics as
            | {
                like_count?: number;
                retweet_count?: number;
                reply_count?: number;
              }
            | undefined;

          posts.push({
            id: tweetId,
            text: tweet.text ?? "",
            authorId,
            authorName: user?.name ?? "",
            authorUsername: user?.username ?? "",
            verified: user?.verified ?? false,
            createdAt: tweet.createdAt ?? "",
            likes: metrics?.like_count ?? 0,
            reposts: metrics?.retweet_count ?? 0,
            replies: metrics?.reply_count ?? 0,
            url: user?.username
              ? `https://x.com/${user.username}/status/${tweetId}`
              : `https://x.com/i/status/${tweetId}`,
          });
        }

        // Sort by engagement score (locally — free)
        posts.sort((a, b) => {
          const scoreA = a.likes * 2 + a.reposts * 3 + a.replies;
          const scoreB = b.likes * 2 + b.reposts * 3 + b.replies;
          return scoreB - scoreA;
        });
      }
    } catch (err: any) {
      errors.push(`Post search failed: ${err?.message ?? String(err)}`);
    }
  }

  const queryLabel = params.queries.join(" + ");
  return { query: queryLabel, news, posts, errors };
}
