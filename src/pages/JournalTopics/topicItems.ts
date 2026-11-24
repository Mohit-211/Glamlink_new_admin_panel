import type { TopicAiOutcome, TopicItem, TopicItemType } from "../../types/topic";
import { shortDate } from "../ProfilePages/pageContent";
import { paths } from "../../paths";

// What the topic screen's parts share: the kinds of item, where each opens, and the words for statuses and outcomes.

export interface Kind {
  type: TopicItemType;
  /** "article" */
  one: string;
  /** "Articles" */
  many: string;
  /** The most new picks an AI run makes of this kind by default (the API's defaults). */
  limit: number;
  /** The topic sets their order; articles and videos show newest first. */
  ordered: boolean;
}

/** The kinds, in the screen's order. */
export const KINDS: Kind[] = [
  { type: "article", one: "article", many: "Articles", limit: 8, ordered: false },
  { type: "video", one: "video", many: "Videos", limit: 6, ordered: false },
  { type: "professional", one: "professional", many: "Professionals", limit: 8, ordered: true },
  { type: "brand", one: "brand", many: "Brands", limit: 6, ordered: true },
  { type: "product", one: "product", many: "Products", limit: 8, ordered: true },
];

export const KIND = Object.fromEntries(KINDS.map((kind) => [kind.type, kind])) as Record<TopicItemType, Kind>;

/** An AI run's lowest score by default. */
export const MIN_SCORE = 60;

/** Where an item opens in the panel. */
export const itemPath = ({ type, id }: Pick<TopicItem, "type" | "id">) => {
  switch (type) {
    case "article":
      return paths.article(id);
    case "video":
      return paths.video(id);
    case "product":
      return paths.product(id);
    default:
      return paths.profilePage(id);
  }
};

/** How an item stands: an article, video or product published or not; a page shown or not. */
export const STATUS: Partial<Record<string, { label: string; color?: string; hint?: string }>> = {
  published: { label: "Published", color: "green" },
  draft: { label: "Draft", color: "gold", hint: "Not on the website until it's published." },
  visible: { label: "Shown", color: "green" },
  hidden: { label: "Hidden", hint: "The page doesn't show on the website, so the topic's page leaves it out." },
};

const price = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** The line under an item's title: what tells it apart. */
export const itemDetail = (item: TopicItem): string => {
  const parts: (string | null | undefined)[] = [];
  if (item.type === "article") parts.push(shortDate(item.date));
  else if (item.type === "video") parts.push(item.series?.name, shortDate(item.date));
  else if (item.type === "product") parts.push(item.brand, typeof item.price === "number" ? price(item.price) : null);
  else parts.push(item.category_label, [item.city, item.state].filter(Boolean).join(", "), item.tagline);
  return parts.filter(Boolean).join(" · ");
};

/** What became of an AI pick. */
export const OUTCOME: Record<TopicAiOutcome, { label: string; color?: string; hint: string }> = {
  added: { label: "Added", color: "green", hint: "Put on the topic." },
  suggested: { label: "Suggested", color: "blue", hint: "Waiting under Suggestions: add it or dismiss it." },
  already_on: { label: "Already on", hint: "An admin put it on the topic while the AI was working." },
  low_score: { label: "Score too low", hint: "Under the run's lowest score: not used." },
  over_limit: { label: "Over the limit", hint: "Past the most new picks asked for its kind: not used." },
};

/** A list per kind, empty. */
export const byKind = <T,>(): Record<TopicItemType, T[]> => ({ article: [], video: [], professional: [], brand: [], product: [] });
