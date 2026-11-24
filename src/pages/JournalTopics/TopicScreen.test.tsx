import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import TopicScreen from "./TopicScreen";
import { POLL } from "./TopicAi";
import type { TopicAiRun, TopicItem, TopicItems } from "../../types/topic";

// No network in tests: each test says what the topic's calls answer.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>(), put: vi.fn<Call>(), delete: vi.fn<Call>() },
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const API = "https://api.test/api/v1/";
const TOPIC_URL = `${API}journal/topic/7`;

const item = (fields: Partial<TopicItem>): TopicItem => ({
  type: "article",
  id: 31,
  title: "Barrier basics",
  slug: "barrier-basics",
  image: null,
  status: "published",
  source: "admin",
  ai: null,
  ...fields,
});

const BRAND_SUGGESTION = item({
  type: "brand",
  id: 5,
  title: "Lumen Labs",
  status: "visible",
  source: "ai",
  ai: { status: "suggested", score: 72, reason: "Makes barrier-repair products.", run_id: 2 },
});

const items = (fields: Partial<TopicItems["items"]> = {}, suggestions: Partial<TopicItems["suggestions"]> = {}): TopicItems => ({
  topic: { id: 7, name: "Skin barrier", slug: "skin-barrier" },
  items: {
    article: [
      item({
        source: "ai",
        date: "2026-11-01T10:00:00.000Z",
        ai: { status: "added", score: 88, reason: "All about the skin barrier.", run_id: 2 },
      }),
    ],
    video: [],
    professional: [],
    brand: [],
    product: [
      item({ type: "product", id: 11, title: "Ceramide cream", brand: "Glow Co", price: 32 }),
      item({ type: "product", id: 12, title: "Barrier serum", status: "draft" }),
    ],
    ...fields,
  },
  suggestions: { article: [], video: [], professional: [], brand: [BRAND_SUGGESTION], product: [], ...suggestions },
});

const run = (fields: Partial<TopicAiRun>): TopicAiRun => ({
  id: 3,
  topic_id: 7,
  status: "running",
  mode: "suggest",
  types: ["article", "video", "professional", "brand", "product"],
  instructions: null,
  model: "gpt-6-luna",
  reasoning_effort: "medium",
  admin_id: 1,
  considered: 0,
  added: 0,
  suggested: 0,
  input_tokens: 0,
  output_tokens: 0,
  error: null,
  started_at: "2026-11-24T10:00:00.000Z",
  finished_at: null,
  ...fields,
});

const refusal = (status: number, code: string, message: string, details?: object) => ({
  isAxiosError: true,
  response: { status, data: { success: false, status, message, code, details } },
});

let answers: Record<string, () => unknown>;

/** Answers each GET by its path under the API; a function's throw is the call's refusal. */
const answerGets = () =>
  vi.mocked(axios.get).mockImplementation(async (url) => {
    const path = String(url).replace(API, "");
    if (!(path in answers)) throw new Error(`No answer for GET ${path}`);
    return { data: { success: true, data: answers[path]() } };
  });

const renderTopic = () =>
  render(
    <MemoryRouter initialEntries={["/topics/7"]}>
      <Routes>
        <Route path="/topics/:id" element={<TopicScreen />} />
      </Routes>
    </MemoryRouter>,
  );

const calls = (method: "get" | "post" | "put" | "delete", url: string) =>
  vi.mocked(axios[method]).mock.calls.filter(([called]) => called === url);

const tab = (name: RegExp) => fireEvent.click(screen.getByRole("tab", { name }));

describe("A topic: by hand or by AI (Nov 24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    POLL.ms = 10;
    answers = {
      "journal/topic/7": () => ({ id: 7, name: "Skin barrier", slug: "skin-barrier", podcasts: [{ id: 4, name: "Dr. Lee", schedule_date: "2026-12-01" }] }),
      "journal/topic/7/paragraphs": () => [],
      "journal/topic/7/items": () => items(),
      "journal/topic/7/ai-runs": () => ({ count: 0, rows: [] }),
    };
    answerGets();
  });

  afterEach(() => {
    POLL.ms = 2500;
  });

  it("lists what is on the topic by kind, with the AI's score and reason", async () => {
    renderTopic();

    const article = await screen.findByRole("link", { name: "Barrier basics" });
    expect(article).toHaveAttribute("href", "/journal/articles/31");
    expect(screen.getByText("AI 88")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Articles \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Products \(2\)/ })).toBeInTheDocument();

    tab(/Products/);
    expect(await screen.findByRole("link", { name: "Ceramide cream" })).toHaveAttribute("href", "/shop/products/11");
    expect(screen.getByText("Glow Co · $32.00")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();

    tab(/Podcast guests/);
    expect(await screen.findByRole("link", { name: "Dr. Lee" })).toHaveAttribute("href", "/media/podcast-schedule/4");
  });

  it("takes an AI suggestion, and takes an item off after asking", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { data: items({ brand: [{ ...BRAND_SUGGESTION, ai: { ...BRAND_SUGGESTION.ai!, status: "added" } }] }, { brand: [] }) },
    });
    renderTopic();
    await screen.findByText("Barrier basics");

    tab(/Brands/);
    expect(await screen.findByText("Makes barrier-repair products.")).toBeInTheDocument();
    expect(screen.getByText("Score 72")).toBeInTheDocument();
    const suggestion = screen.getByText("Makes barrier-repair products.").closest("li") as HTMLElement;
    fireEvent.click(within(suggestion).getByRole("button", { name: /Add/ }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(`${TOPIC_URL}/items`, { items: [{ type: "brand", id: 5 }] }));
    expect(await screen.findByRole("tab", { name: /Brands \(1\)/ })).toBeInTheDocument();

    vi.mocked(axios.delete).mockResolvedValue({ data: { data: items({ article: [] }, { brand: [] }) } });
    tab(/Articles/);
    fireEvent.click(screen.getByRole("button", { name: "Take “Barrier basics” off" }));
    fireEvent.click(await screen.findByRole("button", { name: "Take off" }));

    await waitFor(() => expect(axios.delete).toHaveBeenCalledWith(`${TOPIC_URL}/items/article/31`));
    expect(await screen.findByRole("tab", { name: /Articles \(0\)/ })).toBeInTheDocument();
  });

  it("orders the topic's products, saving every id at once", async () => {
    vi.mocked(axios.put).mockResolvedValue({ data: { data: items() } });
    renderTopic();
    await screen.findByText("Barrier basics");

    tab(/Products/);
    fireEvent.click(await screen.findByRole("button", { name: "Move “Ceramide cream” down" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`${TOPIC_URL}/items/product/order`, { ids: [12, 11] }));
    // Articles show newest first: no order to set.
    tab(/Articles/);
    expect(screen.queryByRole("button", { name: /Move “Barrier basics”/ })).not.toBeInTheDocument();
  });

  it("runs the AI (suggestions first by default), follows it until it's done, then reloads the items", async () => {
    let reads = 0;
    answers["journal/topic/7/ai-runs/3"] = () =>
      ++reads < 2
        ? run({})
        : run({
            status: "done",
            considered: 40,
            suggested: 2,
            input_tokens: 9000,
            output_tokens: 400,
            finished_at: "2026-11-24T10:00:30.000Z",
            picks: [
              { type: "brand", id: 5, title: "Lumen Labs", score: 72, reason: "Makes barrier-repair products.", outcome: "suggested" },
              { type: "video", id: 8, title: "Night routine", score: 41, reason: "Mentions moisturiser once.", outcome: "low_score" },
            ],
          });
    vi.mocked(axios.post).mockResolvedValue({ status: 202, data: { data: run({}) } });
    renderTopic();
    await screen.findByText("Barrier basics");
    const itemLoads = calls("get", `${TOPIC_URL}/items`).length;

    fireEvent.click(screen.getByRole("button", { name: /Run AI/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: /Suggest first/ })).toBeChecked();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Notes for the AI" }), { target: { value: " At-home routines " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Run AI" }));

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(`${TOPIC_URL}/ai-runs`, {
        types: ["article", "video", "professional", "brand", "product"],
        mode: "suggest",
        instructions: "At-home routines",
        limits: { article: 8, video: 6, professional: 8, brand: 6, product: 8 },
        min_score: 60,
      }),
    );
    expect(await screen.findByText("Read 40 items: 0 added, 2 suggested.")).toBeInTheDocument();
    expect(reads).toBe(2);
    expect(calls("get", `${TOPIC_URL}/items`).length).toBe(itemLoads + 1);
    // The picks it used; those it left out, with why, a click away.
    expect(screen.getByText("Suggested")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Left out (1)"));
    expect(await screen.findByText("Mentions moisturiser once.")).toBeInTheDocument();
    expect(screen.getByText("Score too low")).toBeInTheDocument();
  });

  it("follows the run already working on the topic", async () => {
    answers["journal/topic/7/ai-runs/9"] = () => run({ id: 9, status: "done", considered: 12 });
    vi.mocked(axios.post).mockRejectedValue(refusal(409, "AI_RUN_IN_PROGRESS", "This topic has a run working already.", { run_id: 9 }));
    renderTopic();
    await screen.findByText("Barrier basics");

    fireEvent.click(screen.getByRole("button", { name: /Run AI/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Run AI" }));

    expect(await screen.findByText("Read 12 items: 0 added, 0 suggested.")).toBeInTheDocument();
    expect(calls("get", `${TOPIC_URL}/ai-runs/9`).length).toBeGreaterThan(0);
  });

  it("says when the AI isn't set up on the server", async () => {
    vi.mocked(axios.post).mockRejectedValue(refusal(503, "AI_NOT_CONFIGURED", "The AI is not set up (OPENAI_API_KEY)."));
    renderTopic();
    await screen.findByText("Barrier basics");

    fireEvent.click(screen.getByRole("button", { name: /Run AI/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Run AI" }));

    expect(await within(dialog).findByText(/The AI isn't set up on the server/)).toBeInTheDocument();
  });

  it("picks up a run still working when the topic opens", async () => {
    answers["journal/topic/7/ai-runs"] = () => ({ count: 1, rows: [run({ id: 4 })] });
    answers["journal/topic/7/ai-runs/4"] = () => run({ id: 4, status: "done", considered: 5, added: 1, mode: "apply" });
    renderTopic();

    expect(await screen.findByText("Read 5 items: 1 added, 0 suggested.")).toBeInTheDocument();
  });

  it("on an API from before Nov 24, says what is missing and keeps the read-only tabs", async () => {
    answers["journal/topic/7/items"] = () => {
      throw refusal(404, "NOT_FOUND", "Not found.");
    };
    renderTopic();

    expect(await screen.findByText("The API doesn't have topic items yet")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Articles/ })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Paragraph tags/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Run AI/ })).not.toBeInTheDocument();
  });
});
