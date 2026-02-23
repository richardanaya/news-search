#!/usr/bin/env node

import "dotenv/config";
import { Command } from "commander";
import { createClient, searchNews, type SearchParams } from "./search.js";
import { formatOutput } from "./format.js";

// ─── Help text (AI-agent oriented) ──────────────────────────────────────────

const DESCRIPTION = `Search news on X (Twitter) using the official X API.

COST WARNING:
  Every call to this tool costs real money (X API credits).
  You are charged PER POST/STORY returned, not per request.
  DO NOT call this command repeatedly or in loops.
  Combine all your search terms into a SINGLE invocation using
  multiple --search flags. They are merged with OR into one API call.

USAGE FOR AI AGENTS:
  This tool is designed for single-shot news retrieval. Pass ALL
  search terms you need in ONE call. Multiple --search flags are
  combined into a single API query using OR — this means one API
  call, one charge, maximum coverage.

  GOOD (1 API call):
    news-search --search 'gold prices' --search 'silver market' --search 'commodities'

  BAD (3 API calls — 3x the cost for overlapping results):
    news-search --search 'gold prices'
    news-search --search 'silver market'
    news-search --search 'commodities'

HOW IT WORKS:
  1. First queries the X News API for curated news stories
  2. If no news stories are found (or --posts is set), falls back to
     searching recent posts with professional noise filters applied:
     - Excludes retweets, replies, and promoted content
     - Requires posts to contain links (actual news articles)
     - Filters by language (default: English)
     - Sorts by relevance, then ranks locally by engagement
  3. Results are displayed with headlines, summaries, and engagement metrics

DEFAULTS:
  --days 1      Look back 1 day (max 7 for recent search)
  --max 10      Return up to 10 results (pay-per-result, keep it low)
  --lang en     English language filter

EXAMPLES:
  news-search --search 'gold news'
  news-search --search 'ai news' --search 'Xai' --days 7
  news-search --search 'bitcoin' --search 'ethereum' --search 'crypto regulation' --max 20
  news-search --search 'breaking news' --days 1 --json
  news-search --search 'startup funding' --posts --max 15`;

// ─── CLI ─────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("news-search")
  .description(DESCRIPTION)
  .version("1.0.0")
  .requiredOption(
    "-s, --search <query>",
    "Search query (repeatable — all terms are combined with OR into a single API call to save cost)",
    (val: string, prev: string[]) => prev.concat(val),
    [] as string[]
  )
  .option(
    "-d, --days <number>",
    "Number of days to look back (1-7)",
    "1"
  )
  .option(
    "-m, --max <number>",
    "Maximum results to return — you pay per result, keep this low (1-100)",
    "10"
  )
  .option(
    "-l, --lang <code>",
    "Language filter for post search (BCP47 code)",
    "en"
  )
  .option(
    "--raw",
    "Disable professional noise filters on post search (not recommended — wastes credits on retweets/replies)",
    false
  )
  .option(
    "--posts",
    "Also search recent posts in addition to news stories",
    false
  )
  .option(
    "--json",
    "Output raw JSON (useful for piping to other tools or AI agents)",
    false
  )
  .action(async (opts) => {
    // Validate API key
    const apiKey = process.env.X_API_KEY;
    if (!apiKey) {
      console.error(
        "Error: X_API_KEY not found.\n" +
          "Set it in a .env file or as an environment variable.\n" +
          "See .env.example for the expected format."
      );
      process.exit(1);
    }

    // Parse and validate options
    const days = Math.min(7, Math.max(1, parseInt(opts.days, 10) || 1));
    const max = Math.min(100, Math.max(1, parseInt(opts.max, 10) || 10));
    const queries: string[] = opts.search;

    if (queries.length === 0) {
      console.error("Error: At least one --search query is required.");
      process.exit(1);
    }

    const params: SearchParams = {
      queries,
      days,
      max,
      lang: opts.lang,
      raw: opts.raw,
      posts: opts.posts,
    };

    // Execute search
    const client = createClient(apiKey);

    try {
      const result = await searchNews(client, params);
      const output = formatOutput(result, opts.json);
      console.log(output);

      // Exit with error code if there were errors and no results
      if (
        result.errors.length > 0 &&
        result.news.length === 0 &&
        result.posts.length === 0
      ) {
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`Fatal error: ${err?.message ?? String(err)}`);
      process.exit(1);
    }
  });

program.parse();
