// A topic's items, by hand or by AI (Nov 24). Admins attach articles, videos (The Beauty Vault's episodes are videos),
// professionals, brands and products to a topic, or run an AI (OpenAI) that reads what the site shows and picks what
// fits. Backend: website/content (topicItems.service.js, topicAi.service.js; its handoff, section 8.17).

export type TopicItemType = "article" | "video" | "professional" | "brand" | "product";

/** The AI's part in an item: what it scored it and why. */
export interface TopicItemAi {
  /** added: an AI run put it on; suggested: waiting for an admin; rejected: an admin took it off. */
  status: "added" | "suggested" | "rejected";
  /** 0 to 100. */
  score: number;
  /** One sentence for the editor. */
  reason: string | null;
  run_id: number | null;
}

/** One item on a topic (or suggested for it), as admins see it. */
export interface TopicItem {
  type: TopicItemType;
  id: number;
  title: string | null;
  slug: string | null;
  image: string | null;
  /** Articles, videos and products: published or draft. Pages: visible or hidden. */
  status: string | null;
  /** ai: an AI run attached it (or a suggestion an admin took); admin: attached by hand. */
  source: "ai" | "admin";
  ai: TopicItemAi | null;
  /** Articles: the publish date; videos: the YouTube date; products: when made. */
  date?: string | null;
  /** Videos. */
  series?: { id: number; name: string; slug: string } | null;
  /** Professional and brand pages. */
  tagline?: string | null;
  city?: string | null;
  state?: string | null;
  category_label?: string | null;
  /** Products: the brand's name as written, and the price. */
  brand?: string | null;
  price?: number | null;
}

/**
 * GET /journal/topic/:id/items (and every change to them answers it): what is on the topic, by kind (articles and
 * videos newest first, the rest in the topic's order), and what a "suggest" run left for an admin, best first.
 */
export interface TopicItems {
  topic: { id: number; name: string; slug: string | null };
  items: Record<TopicItemType, TopicItem[]>;
  suggestions: Record<TopicItemType, TopicItem[]>;
}

/** apply: the AI's picks go on the topic at once; suggest: they wait for an admin. */
export type TopicAiMode = "apply" | "suggest";

/** What an AI run is asked for (POST /journal/topic/:id/ai-runs). */
export interface TopicAiRunRequest {
  /** All kinds when left out. */
  types?: TopicItemType[];
  mode?: TopicAiMode;
  /** Notes for the AI, at most 1,000 characters. */
  instructions?: string;
  /** The most new picks per kind, 1 to 30. */
  limits?: Partial<Record<TopicItemType, number>>;
  /** Picks scored under it aren't used: 0 to 100, 60 by default. */
  min_score?: number;
}

/**
 * What became of one pick: added (now on the topic), suggested, already_on (an admin added it meanwhile), low_score
 * (under min_score) or over_limit (past the kind's limit).
 */
export type TopicAiOutcome = "added" | "suggested" | "already_on" | "low_score" | "over_limit";

export interface TopicAiPick {
  type: TopicItemType;
  id: number;
  title: string | null;
  score: number;
  reason: string | null;
  outcome: TopicAiOutcome;
}

/** An AI run. While `status` is running, read it again every few seconds. */
export interface TopicAiRun {
  id: number;
  topic_id: number;
  status: "running" | "done" | "failed";
  mode: TopicAiMode;
  types: TopicItemType[];
  instructions: string | null;
  model: string | null;
  reasoning_effort: string | null;
  admin_id: number | null;
  /** How many items the AI read. */
  considered: number;
  added: number;
  suggested: number;
  /** What OpenAI bills. */
  input_tokens: number;
  output_tokens: number;
  /** Every pick, best first (left out of the runs list). */
  picks?: TopicAiPick[];
  /** The kinds that failed, and why ("video: OpenAI did not answer. Try again in a moment."). */
  error: string | null;
  started_at: string;
  finished_at: string | null;
}
