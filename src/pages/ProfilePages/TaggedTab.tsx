import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Alert, Button, Empty, Table, Tag, type TableColumnsType } from "antd";
import { GetPageArticles, GetPageVideos } from "../../services/Api/ProfilesApi";
import { apiErrorMessage, apiErrorStatus } from "../../utils/apiError";
import type { Paged } from "../../types/api";
import type { TaggedArticle, TaggedVideo } from "../../types/profile";
import { plural, shortDate } from "./pageContent";
import styles from "./ProfilePages.module.scss";
import { paths } from "../../paths";

/** The Beauty Vault, the podcast's series on Watch. */
export const PODCAST_SERIES = "beauty-vault-podcast";

const PAGE_SIZE = 10;

interface PageList<T> {
  page: number;
  count: number;
  rows: T[];
  loading: boolean;
  /** The website's list doesn't answer for this page (404: the website doesn't show it). */
  hidden: boolean;
  error: string | null;
  setPage: (page: number) => void;
  retry: () => void;
}

type ListState<T> = Omit<PageList<T>, "setPage" | "retry">;

/**
 * One of the website's lists of a page (public, paged): it answers only while the website shows the page, so a 404
 * reads as "hidden" rather than as a failure.
 */
const usePageList = <T,>(
  slug: string | null,
  fetch: (slug: string, page: number) => Promise<Paged<T> | undefined>,
): PageList<T> => {
  const [state, setState] = useState<ListState<T>>({
    page: 1,
    count: 0,
    rows: [],
    loading: Boolean(slug),
    hidden: false,
    error: null,
  });
  const [page, setPage] = useState(1);
  const [retries, setRetries] = useState(0);
  // The request is the same each render; the slug, the page and retries are what change.
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;

  useEffect(() => {
    if (!slug) return;
    let current = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchRef
      .current(slug, page)
      .then((data) => {
        if (!current) return;
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        setState({ page, count: Number(data?.count ?? rows.length), rows, loading: false, hidden: false, error: null });
      })
      .catch((err) => {
        if (!current) return;
        if (apiErrorStatus(err) === 404) {
          setState({ page: 1, count: 0, rows: [], loading: false, hidden: true, error: null });
        } else {
          setState((s) => ({ ...s, loading: false, error: apiErrorMessage(err) || "Couldn't load this list" }));
        }
      });
    return () => {
      current = false;
    };
  }, [slug, page, retries]);

  return { ...state, setPage, retry: () => setRetries((n) => n + 1) };
};

const articleColumns: TableColumnsType<TaggedArticle> = [
  {
    title: "Article",
    key: "title",
    render: (_, article) => (
      <div>
        <Link to={paths.article(article.id)} className={styles.pageName}>
          {article.title}
        </Link>
        {article.journal_author?.name && <div className={styles.sub}>By {article.journal_author.name}</div>}
      </div>
    ),
  },
  {
    title: "Category",
    key: "category",
    width: 180,
    render: (_, article) => article.journal_category?.title ?? <span className={styles.muted}>—</span>,
  },
  {
    title: "Published",
    key: "date",
    width: 140,
    render: (_, article) => shortDate(article.publish_date || article.created_at) || "—",
  },
];

const videoColumns: TableColumnsType<TaggedVideo> = [
  {
    title: "Episode",
    key: "title",
    render: (_, video) => (
      <div>
        <Link to={paths.video(video.id)} className={styles.pageName}>
          {video.title}
        </Link>
        {video.is_featured && (
          <div>
            <Tag color="gold">Featured</Tag>
          </div>
        )}
      </div>
    ),
  },
  {
    title: "Published",
    key: "date",
    width: 140,
    render: (_, video) => shortDate(video.published_at) || "—",
  },
];

interface ListSectionProps<T> {
  title: string;
  how: React.ReactNode;
  empty: string;
  list: PageList<T>;
  columns: TableColumnsType<T>;
}

const ListSection = <T extends { id: number }>({ title, how, empty, list, columns }: ListSectionProps<T>) => (
  <section className={styles.taggedSection}>
    <div className={styles.panelHead}>
      <h4 className={styles.panelTitle}>
        {title}
        {!list.loading && !list.error && list.count > 0 && <span className={styles.muted}> · {list.count}</span>}
      </h4>
    </div>
    <p className={styles.hint}>{how}</p>
    {list.error ? (
      <Alert
        type="error"
        showIcon
        title={list.error}
        action={
          <Button size="small" onClick={list.retry}>
            Try again
          </Button>
        }
      />
    ) : (
      <Table<T>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={list.rows}
        loading={list.loading}
        locale={{ emptyText: empty }}
        pagination={
          list.count > PAGE_SIZE
            ? {
                current: list.page,
                pageSize: PAGE_SIZE,
                total: list.count,
                showSizeChanger: false,
                onChange: list.setPage,
              }
            : false
        }
      />
    )}
  </section>
);

interface TaggedTabProps {
  /** The address the page answers to; null when it has none. */
  slug: string | null;
  /** Whether the website shows the page: its lists answer only then. */
  visible: boolean;
}

/**
 * Where the page is tagged (read-only): the Journal articles that feature it and The Beauty Vault episodes it is in,
 * from the website's own lists (GET /profiles/:slug/articles and /videos?series=beauty-vault-podcast). Each row opens
 * its admin screen, where tags are changed.
 */
const TaggedTab = ({ slug, visible }: TaggedTabProps) => {
  const shownSlug = visible ? slug : null;
  const articles = usePageList<TaggedArticle>(shownSlug, (s, page) =>
    GetPageArticles(s, { page, limit: PAGE_SIZE }).then((res) => res.data.data),
  );
  const episodes = usePageList<TaggedVideo>(shownSlug, (s, page) =>
    GetPageVideos(s, { page, limit: PAGE_SIZE, series: PODCAST_SERIES }).then((res) => res.data.data),
  );
  const handle = slug ? `@${slug}` : "an @handle";

  const intro = (
    <p className={styles.contentIntro}>
      The published Journal articles and The Beauty Vault episodes this page is tagged in, as the website lists them.
      Tags are set on each article and episode: open one to change them.
    </p>
  );

  // The website's lists answer only for a page it shows (backend profile.service.js, visibleAccount).
  if (!shownSlug || articles.hidden || episodes.hidden) {
    return (
      <div>
        {intro}
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div className={styles.emptyText}>
              <strong>{slug ? "The website doesn't show this page" : "This page has no address yet"}</strong>
              <p>
                These lists come from the page on the website, so they can't be read while it's hidden. Its tags are
                kept, and show here (and on the page) once it's back on the website.
              </p>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      {intro}
      <ListSection<TaggedArticle>
        title="In the Glamlink Journal"
        how={
          <>
            An article tags the page with {handle} in its text, or under <strong>Featured people</strong> on its
            screen.
          </>
        }
        empty="No published article features this page."
        list={articles}
        columns={articleColumns}
      />
      <ListSection<TaggedVideo>
        title="On The Beauty Vault"
        how={
          <>
            An episode tags the page under <strong>People</strong> on its video's screen (Watch, series The Beauty
            Vault).
          </>
        }
        empty="No published episode of The Beauty Vault has this page in it."
        list={episodes}
        columns={videoColumns}
      />
      {!articles.loading && !episodes.loading && articles.count + episodes.count > 0 && (
        <div className={styles.hint}>
          {plural(articles.count, "article")} and {plural(episodes.count, "episode")} in all. Drafts and other
          series don't show here.
        </div>
      )}
    </div>
  );
};

export default TaggedTab;
