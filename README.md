# news-search

A cost-efficient CLI for searching news on X (Twitter) using the official X API. Designed for single-shot retrieval — all search terms are merged into one API call to minimize cost.

## Requirements

- Node.js 18+
- An X API bearer token with access to the News and Posts search endpoints

## Setup

```bash
npm install
npm run build
```

Create a `.env` file in the project root:

```
X_API_KEY=your_bearer_token_here
```

## Usage

```bash
news-search --search <query> [options]
```

The `--search` flag is repeatable. All terms are combined with OR into a single API call — use this to your advantage.

### Options

| Flag | Default | Description |
|---|---|---|
| `-s, --search <query>` | required | Search query, repeatable |
| `-d, --days <n>` | `1` | Days to look back (1–7) |
| `-m, --max <n>` | `10` | Max results (you pay per result) |
| `-l, --lang <code>` | `en` | Language filter (BCP47) |
| `--posts` | off | Also search recent posts |
| `--raw` | off | Disable noise filters on post search |
| `--json` | off | Output raw JSON |

### Examples

```bash
# Basic search
news-search --search 'gold prices'

# Broad coverage with synonyms and related terms (recommended)
news-search --search 'gold' --search 'XAU' --search 'gold rally' \
            --search 'silver' --search 'XAG' --search 'precious metals'

# Look back 7 days, return up to 20 results
news-search --search 'AI regulation' --search 'OpenAI' --days 7 --max 20

# Include posts in addition to news stories
news-search --search 'bitcoin' --search 'crypto' --posts

# JSON output for piping to other tools
news-search --search 'fed rate decision' --json | jq '.news[].headline'
```

## Cost

You are charged per result returned, not per request. Keep `--max` low. Use multiple `--search` terms in a single call rather than making multiple calls — they are free to combine.

## How it works

1. Queries the X News API for curated, AI-summarised news stories
2. If no stories are found (or `--posts` is set), falls back to searching recent posts with filters applied: no retweets, no replies, links required, language-filtered, sorted by engagement
3. Results are printed to stdout with headlines, summaries, and source links

## Development

```bash
# Run without building
npm run dev -- --search 'gold prices'

# Build
npm run build

# Run built output
npm start -- --search 'gold prices'
```

## AI agent usage

This tool is designed to be called by AI agents. When invoking it, generate multiple `--search` flags covering different angles: synonyms, tickers, key people, related topics, and alternate phrasings. All terms go into one API call at no extra cost, so broader is better.
