import chalk from "chalk";
import type { SearchOutput, NewsResult, PostResult } from "./search.js";

// ─── Time helpers ────────────────────────────────────────────────────────────

function timeAgo(isoDate: string): string {
  if (!isoDate) return "";
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatNewsItem(item: NewsResult, index: number): string {
  const lines: string[] = [];
  const num = chalk.dim(`[${index + 1}]`);
  const headline = chalk.bold.white(item.headline || "(no headline)");
  const cat = item.category ? chalk.cyan(`[${item.category}]`) : "";
  const time = item.updatedAt ? chalk.dim(timeAgo(item.updatedAt)) : "";

  lines.push(`${num} ${cat} ${headline} ${time}`);

  if (item.hook) {
    lines.push(`    ${chalk.yellow(item.hook)}`);
  }

  if (item.summary) {
    // Wrap summary to ~90 chars with indent
    const wrapped = wordWrap(item.summary, 86);
    for (const line of wrapped) {
      lines.push(`    ${chalk.dim(line)}`);
    }
  }

  if (item.keywords.length > 0) {
    lines.push(`    ${chalk.dim("tags:")} ${chalk.blue(item.keywords.join(", "))}`);
  }

  return lines.join("\n");
}

function formatPostItem(item: PostResult, index: number): string {
  const lines: string[] = [];
  const num = chalk.dim(`[${index + 1}]`);
  const handle = chalk.cyan(`@${item.authorUsername}`);
  const name = chalk.white(item.authorName);
  const verified = item.verified ? chalk.blue(" ✓") : "";
  const time = item.createdAt ? chalk.dim(timeAgo(item.createdAt)) : "";

  lines.push(`${num} ${handle} ${name}${verified} ${time}`);

  // Tweet text — wrap to ~90 chars
  const wrapped = wordWrap(item.text, 86);
  for (const line of wrapped) {
    lines.push(`    ${line}`);
  }

  // Engagement
  const metrics = [
    `${chalk.red("♥")} ${item.likes}`,
    `${chalk.green("↻")} ${item.reposts}`,
    `${chalk.blue("↩")} ${item.replies}`,
  ].join(chalk.dim("  ·  "));
  lines.push(`    ${metrics}`);

  // Link
  lines.push(`    ${chalk.dim(item.url)}`);

  return lines.join("\n");
}

function wordWrap(text: string, width: number): string[] {
  const lines: string[] = [];
  const words = text.split(/\s+/);
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > width) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Main format function ────────────────────────────────────────────────────

export function formatOutput(output: SearchOutput, json: boolean): string {
  if (json) {
    return JSON.stringify(output, null, 2);
  }

  const sections: string[] = [];
  const divider = chalk.dim("─".repeat(72));

  // Header
  sections.push("");
  sections.push(
    chalk.bold.white(`  News search: `) + chalk.yellow(output.query)
  );
  sections.push(divider);

  // News stories
  if (output.news.length > 0) {
    sections.push("");
    sections.push(
      chalk.bold.underline(`  News Stories (${output.news.length})`)
    );
    sections.push("");
    for (let i = 0; i < output.news.length; i++) {
      sections.push(formatNewsItem(output.news[i], i));
      if (i < output.news.length - 1) sections.push("");
    }
  }

  // Posts
  if (output.posts.length > 0) {
    sections.push("");
    sections.push(
      chalk.bold.underline(`  Posts (${output.posts.length})`)
    );
    sections.push("");
    for (let i = 0; i < output.posts.length; i++) {
      sections.push(formatPostItem(output.posts[i], i));
      if (i < output.posts.length - 1) sections.push("");
    }
  }

  // No results
  if (output.news.length === 0 && output.posts.length === 0) {
    sections.push("");
    sections.push(chalk.yellow("  No results found."));
  }

  // Errors
  if (output.errors.length > 0) {
    sections.push("");
    sections.push(chalk.red.bold("  Errors:"));
    for (const err of output.errors) {
      sections.push(chalk.red(`    - ${err}`));
    }
  }

  sections.push("");
  sections.push(divider);
  sections.push("");

  return sections.join("\n");
}
