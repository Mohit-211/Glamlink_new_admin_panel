import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import axios from "axios";
import TaggedTab from "./TaggedTab";
import type { TaggedArticle, TaggedVideo } from "../../types/profile";

// No network in tests: each test says what the website's lists answer.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>(), put: vi.fn<Call>() },
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const ARTICLES = "https://api.test/api/v1/profiles/revance/articles";
const VIDEOS = "https://api.test/api/v1/profiles/revance/videos";

const article = (id: number, title: string): TaggedArticle => ({
  id,
  slug: `article-${id}`,
  title,
  short_description: null,
  cover_image: null,
  publish_date: "2026-10-20T00:00:00.000Z",
  is_featured: false,
  created_at: "2026-10-19T00:00:00.000Z",
  journal_author: { id: 1, name: "Melanie Marks" },
  journal_category: { id: 2, title: "Pro Spotlight", slug: "pro-spotlight" },
});

const episode = (id: number, title: string): TaggedVideo => ({
  id,
  slug: `episode-${id}`,
  title,
  youtube_id: "abc",
  thumbnail: null,
  published_at: "2026-10-28T00:00:00.000Z",
  duration_seconds: 1800,
  is_featured: false,
  series: { id: 3, name: "The Beauty Vault", slug: "beauty-vault-podcast" },
});

/** A list's answer, or its refusal. */
const reply = (body: object) => ("isAxiosError" in body ? Promise.reject(body) : Promise.resolve({ data: { data: body } }));

/** Answers the two lists by their address. */
const answer = (articles: object, videos: object) =>
  vi.mocked(axios.get).mockImplementation((url) => {
    if (url === ARTICLES) return reply(articles);
    if (url === VIDEOS) return reply(videos);
    return Promise.reject(new Error(`No answer for GET ${String(url)}`));
  });

const notFound = { isAxiosError: true, response: { status: 404, data: { message: "Page not found.", code: "NOT_FOUND" } } };

const renderTab = (visible = true, slug: string | null = "revance") =>
  render(
    <MemoryRouter>
      <TaggedTab slug={slug} visible={visible} />
    </MemoryRouter>,
  );

describe("Where a page is tagged", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the Journal articles and The Beauty Vault episodes, each opening its admin screen", async () => {
    answer({ count: 1, rows: [article(31, "Five brands to watch")] }, { count: 1, rows: [episode(7, "Skin barrier 101")] });
    renderTab();

    expect(await screen.findByRole("link", { name: "Five brands to watch" })).toHaveAttribute("href", "/edit-journal/31");
    expect(await screen.findByRole("link", { name: "Skin barrier 101" })).toHaveAttribute("href", "/watch/videos/7");
    expect(axios.get).toHaveBeenCalledWith(ARTICLES, { params: { page: 1, limit: 10 } });
    expect(axios.get).toHaveBeenCalledWith(VIDEOS, { params: { page: 1, limit: 10, series: "beauty-vault-podcast" } });
    expect(screen.getByText("By Melanie Marks")).toBeInTheDocument();
    expect(screen.getByText("Pro Spotlight")).toBeInTheDocument();

    // How a tag changes: an @handle or Featured people on the article, People on the episode.
    expect(screen.getByText(/An article tags the page with @revance in its text/)).toBeInTheDocument();
    expect(screen.getByText("Featured people")).toBeInTheDocument();
    expect(screen.getByText("People")).toBeInTheDocument();
  });

  it("pages a long list on the server", async () => {
    answer(
      { count: 25, rows: Array.from({ length: 10 }, (_, i) => article(i + 1, `Article ${i + 1}`)) },
      { count: 0, rows: [] },
    );
    renderTab();

    const journal = (await screen.findByText("In the Glamlink Journal")).closest("section") as HTMLElement;
    await within(journal).findByRole("link", { name: "Article 1" });
    expect(within(journal).getByText("· 25")).toBeInTheDocument();
    expect(screen.getByText("No published episode of The Beauty Vault has this page in it.")).toBeInTheDocument();

    fireEvent.click(within(journal).getByTitle("3"));
    await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith(ARTICLES, { params: { page: 3, limit: 10 } }));
  });

  it("says why the lists can't be read while the website doesn't show the page, without asking", async () => {
    renderTab(false);

    expect(await screen.findByText("The website doesn't show this page")).toBeInTheDocument();
    expect(screen.getByText(/they can't be read while it's hidden/)).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("reads the website's 404 as a hidden page, not as a failure", async () => {
    answer(notFound, notFound);
    renderTab();

    expect(await screen.findByText("The website doesn't show this page")).toBeInTheDocument();
    expect(screen.queryByText("Page not found.")).not.toBeInTheDocument();
  });
});
