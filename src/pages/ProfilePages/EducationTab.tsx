import React, { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Alert, Button, Empty, Popconfirm, Space, Spin, Tag, Tooltip, message } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  FileTextOutlined,
  HolderOutlined,
  PlayCircleFilled,
  PlusOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import {
  DeletePageEducation,
  GetPageEducation,
  GetPageEducationItem,
  OrderPageEducation,
  SetPageEducationStatus,
} from "../../services/Api/ProfilesApi";
import { apiErrorMessage, apiErrorStatus } from "../../utils/apiError";
import type { PageEducationItem } from "../../types/profile";
import EducationForm from "./EducationForm";
import { ORDER_WORDS, loadAll, moveItem, plural, shortDate, useOrderSaver } from "./pageContent";
import { educationPostUrl } from "./pageStatus";
import styles from "./ProfilePages.module.scss";

/** The page shows this many published posts; the rest are under its "View all". */
const SHOWN_ON_PAGE = 3;

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

interface EducationTabProps {
  userId: number;
  /** The page's address and whether the website shows it, for "View on site". */
  page: { slug: string | null; visible: boolean };
}

/**
 * A page's Education (GET /profiles/admin/:userId/education and the calls beside it): its videos and articles, drafts
 * too, in the page's order. Published posts show on the page at once, each with its own page; drafts don't.
 */
const EducationTab = ({ userId, page }: EducationTabProps) => {
  const [items, setItems] = useState<PageEducationItem[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<PageEducationItem | "new" | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [working, setWorking] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let current = true;
    loadAll((params) => GetPageEducation(userId, params).then((res) => res.data.data))
      .then((rows) => {
        if (!current) return;
        setItems(rows);
        setLoad({ status: "ready" });
      })
      .catch((err) => {
        console.error("Error loading the page's education:", err);
        if (current) setLoad({ status: "error", message: apiErrorMessage(err) || "Couldn't load the page's posts" });
      });
    return () => {
      current = false;
    };
  }, [userId, reloadKey]);

  const saveOrder = useCallback((ids: number[]) => OrderPageEducation(userId, ids), [userId]);
  const orderFailed = useCallback(
    (err: unknown) => {
      message.error(apiErrorMessage(err) || "Couldn't save the new order");
      refresh();
    },
    [refresh],
  );
  const order = useOrderSaver(saveOrder, orderFailed);

  const move = (from: number, to: number) => {
    const next = moveItem(items, from, to);
    if (next === items) return;
    setItems(next);
    order.schedule(next.map((item) => item.id));
  };

  // The list has no text: a post opens with its own call.
  const openEditor = async (item: PageEducationItem) => {
    setOpening(item.id);
    try {
      const res = await GetPageEducationItem(userId, item.id);
      setEditing({ ...item, ...res.data.data, id: item.id });
    } catch (err) {
      message.error(apiErrorMessage(err) || "Couldn't open the post");
      if (apiErrorStatus(err) === 404) refresh();
    } finally {
      setOpening(null);
    }
  };

  const replace = (saved: PageEducationItem) =>
    setItems((list) => list.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)));

  const setStatus = async (item: PageEducationItem, status: PageEducationItem["status"]) => {
    setWorking(item.id);
    try {
      const res = await SetPageEducationStatus(userId, item.id, status);
      replace({ ...item, ...(res.data.data ?? { status }), id: item.id });
      message.success(status === "draft" ? `“${item.title}” is off the page` : `“${item.title}” is published`);
    } catch (err) {
      // An article with no text can't be published (400 on `body`).
      message.error(apiErrorMessage(err) || `Couldn't ${status === "draft" ? "unpublish" : "publish"} the post`);
      if (apiErrorStatus(err) === 404) refresh();
    } finally {
      setWorking(null);
    }
  };

  const remove = async (item: PageEducationItem) => {
    setWorking(item.id);
    try {
      await DeletePageEducation(userId, item.id);
      setItems((list) => list.filter((row) => row.id !== item.id));
      message.success(`“${item.title}” is deleted`);
    } catch (err) {
      message.error(apiErrorMessage(err) || "Couldn't delete the post");
      if (apiErrorStatus(err) === 404) refresh();
    } finally {
      setWorking(null);
    }
  };

  const rowDrag = (index: number): React.HTMLAttributes<HTMLLIElement> => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLLIElement>) => {
      dragFrom.current = index;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(items[index]?.id ?? ""));
    },
    onDragOver: (event: DragEvent<HTMLLIElement>) => {
      if (dragFrom.current === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dropAt !== index) setDropAt(index);
    },
    onDrop: (event: DragEvent<HTMLLIElement>) => {
      const from = dragFrom.current;
      if (from === null) return;
      event.preventDefault();
      dragFrom.current = null;
      setDropAt(null);
      move(from, index);
    },
    onDragEnd: () => {
      dragFrom.current = null;
      setDropAt(null);
    },
  });

  if (load.status === "loading") {
    return (
      <div className={styles.panelBody}>
        <Spin />
      </div>
    );
  }
  if (load.status === "error") {
    return (
      <Alert
        type="error"
        showIcon
        title={load.message}
        action={
          <Button
            size="small"
            onClick={() => {
              setLoad({ status: "loading" });
              refresh();
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  if (editing !== null) {
    return (
      <EducationForm
        key={editing === "new" ? "new" : editing.id}
        userId={userId}
        editing={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    );
  }

  const published = items.filter((item) => item.status === "published");
  const onPage = new Set(published.slice(0, SHOWN_ON_PAGE).map((item) => item.id));
  const drafts = items.length - published.length;
  const live = page.visible && page.slug ? page.slug : null;

  return (
    <div>
      <div className={styles.contentHead}>
        <p className={styles.contentIntro}>
          Videos and articles in the page's Education section, drafts too, in the page's order. Published posts show
          at once (the first {SHOWN_ON_PAGE} on the page, all of them under "View all"), each with its own page;
          drafts don't.
        </p>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>
          Add a post
        </Button>
      </div>

      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No posts yet. A how-to video or an article with pictures shows in the page's Education section, and each gets its own page."
        />
      ) : (
        <>
          <div className={styles.listSummary}>
            <span>
              {plural(items.length, "post")}
              {drafts > 0 && `, ${plural(drafts, "draft")}`}. Drag to reorder, or use the arrows.
              {!live && " The page isn't on the website, so its posts can't be viewed there."}
            </span>
            {order.status !== "idle" && (
              <span className={styles.muted} role="status">
                {ORDER_WORDS[order.status]}
              </span>
            )}
          </div>
          <ul className={styles.eduList}>
            {items.map((item, index) => {
              const isVideo = item.kind === "video";
              const isDraft = item.status !== "published";
              const cover = item.cover_image || item.video?.thumbnail || null;
              const name = `“${item.title}”`;
              return (
                <li
                  key={item.id}
                  {...rowDrag(index)}
                  className={dropAt === index ? `${styles.eduRow} ${styles.dropTarget}` : styles.eduRow}
                  aria-label={item.title}
                >
                  <HolderOutlined className={styles.dragHandle} aria-hidden />
                  <div className={styles.eduCover}>
                    {cover ? (
                      <img src={cover} alt="" draggable={false} loading="lazy" />
                    ) : isVideo ? (
                      <VideoCameraOutlined />
                    ) : (
                      <FileTextOutlined />
                    )}
                    {isVideo && cover && (
                      <span className={styles.mediaPlay}>
                        <PlayCircleFilled />
                      </span>
                    )}
                  </div>
                  <div className={styles.eduText}>
                    <div className={styles.eduTitle}>{item.title}</div>
                    <div className={styles.tags}>
                      <Tag>{isVideo ? "Video" : "Article"}</Tag>
                      {isDraft ? <Tag>Draft</Tag> : <Tag color="green">Published</Tag>}
                      {onPage.has(item.id) && <Tag color="blue">On the page</Tag>}
                    </div>
                    <div className={styles.sub}>
                      {isDraft
                        ? `Draft, last changed ${shortDate(item.updated_at)}`
                        : `Published ${shortDate(item.published_at)}`}
                    </div>
                  </div>
                  <div className={styles.eduActions}>
                    <Space.Compact size="small">
                      <Tooltip title="Move up">
                        <Button
                          icon={<ArrowUpOutlined />}
                          aria-label={`Move ${name} up`}
                          disabled={index === 0}
                          onClick={() => move(index, index - 1)}
                        />
                      </Tooltip>
                      <Tooltip title="Move down">
                        <Button
                          icon={<ArrowDownOutlined />}
                          aria-label={`Move ${name} down`}
                          disabled={index >= items.length - 1}
                          onClick={() => move(index, index + 1)}
                        />
                      </Tooltip>
                    </Space.Compact>
                    {!isDraft && live && item.slug && (
                      <Button
                        size="small"
                        icon={<ExportOutlined />}
                        href={educationPostUrl(live, item.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on site
                      </Button>
                    )}
                    <Button
                      size="small"
                      loading={working === item.id}
                      aria-label={`${isDraft ? "Publish" : "Unpublish"} ${name}`}
                      onClick={() => setStatus(item, isDraft ? "published" : "draft")}
                    >
                      {isDraft ? "Publish" : "Unpublish"}
                    </Button>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      loading={opening === item.id}
                      disabled={opening !== null}
                      aria-label={`Edit ${name}`}
                      onClick={() => openEditor(item)}
                    >
                      Edit
                    </Button>
                    <Popconfirm
                      title={`Delete ${name}?`}
                      description="It comes off the page with its own page, for good. To keep it, unpublish it instead."
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                      cancelText="Keep it"
                      onConfirm={() => remove(item)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Delete ${name}`} />
                    </Popconfirm>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default EducationTab;
