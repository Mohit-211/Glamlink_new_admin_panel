import React, { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Alert, Button, Empty, Form, Input, Modal, Popconfirm, Progress, Space, Spin, Tag, Tooltip, message } from "antd";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ImportOutlined,
  LinkOutlined,
  PictureOutlined,
  PlayCircleFilled,
  UploadOutlined,
  VideoCameraAddOutlined,
} from "@ant-design/icons";
import {
  AddPageMediaFiles,
  AddPageMediaLink,
  DeletePageMedia,
  GetPageMedia,
  ImportPageCardMedia,
  OrderPageMedia,
  UpdatePageMedia,
} from "../../services/Api/ProfilesApi";
import { apiErrorMessage, apiErrorStatus } from "../../utils/apiError";
import { showFieldError } from "../../utils/formErrors";
import { videoPoster } from "../../utils/videoPoster";
import type { PageMediaItem } from "../../types/profile";
import {
  IMAGE_BATCH,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  ORDER_WORDS,
  chunk,
  isMp4,
  loadAll,
  moveItem,
  plural,
  useOrderSaver,
  videoLink,
} from "./pageContent";
import styles from "./ProfilePages.module.scss";

/** The page shows this many items that aren't hidden; the rest are under its "View all". */
const SHOWN_ON_PAGE = 5;
/** Captions and alt text. */
const TEXT_MAX = 255;

const SOURCE_LABEL: Partial<Record<PageMediaItem["source"], string>> = { youtube: "YouTube", vimeo: "Vimeo" };

const nameOf = (item: PageMediaItem) => (item.kind === "video" ? "video" : "photo");
const pictureOf = (item: PageMediaItem) => (item.kind === "video" ? item.thumbnail : item.url);

interface Busy {
  label: string;
  /** null while there is nothing to count (a poster being made, an import). */
  percent: number | null;
}

type LoadState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

interface LinkValues {
  url: string;
  caption: string;
}

/** "Add a YouTube or Vimeo link": the link and an optional caption (POST .../media as JSON). */
const LinkModal = ({ userId, onClose, onAdded }: { userId: number; onClose: () => void; onAdded: () => void }) => {
  const [form] = Form.useForm<LinkValues>();
  const [saving, setSaving] = useState(false);

  const save = async ({ url, caption }: LinkValues) => {
    setSaving(true);
    try {
      await AddPageMediaLink(userId, { url: videoLink(url) ?? url.trim(), ...(caption.trim() ? { caption: caption.trim() } : {}) });
      message.success("Video added to the page");
      onAdded();
    } catch (err) {
      message.error(showFieldError(form, err) || apiErrorMessage(err) || "Couldn't add the video");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Add a YouTube or Vimeo video"
      okText="Add video"
      onOk={() => form.submit()}
      confirmLoading={saving}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form<LinkValues> form={form} layout="vertical" initialValues={{ url: "", caption: "" }} onFinish={save}>
        <Form.Item
          name="url"
          label="Video link"
          rules={[
            { required: true, whitespace: true, message: "Paste the video's link" },
            {
              validator: async (_, value: string | undefined) => {
                if (value?.trim() && !videoLink(value)) throw new Error("Paste a link to a video on YouTube or Vimeo");
              },
            },
          ]}
        >
          <Input placeholder="https://www.youtube.com/watch?v=…" autoComplete="off" />
        </Form.Item>
        <Form.Item name="caption" label="Caption" extra="Optional. Shown with the video on the page.">
          <Input maxLength={TEXT_MAX} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface DetailsValues {
  caption: string;
  alt: string;
}

/** An item's caption and alt text (PUT .../media/:id); "" clears either. */
const DetailsModal = ({
  userId,
  item,
  onClose,
  onSaved,
}: {
  userId: number;
  item: PageMediaItem;
  onClose: () => void;
  onSaved: (item: PageMediaItem) => void;
}) => {
  const [form] = Form.useForm<DetailsValues>();
  const [saving, setSaving] = useState(false);
  const picture = pictureOf(item);

  const save = async ({ caption, alt }: DetailsValues) => {
    setSaving(true);
    const fields = { caption: caption.trim(), alt: alt.trim() };
    try {
      const res = await UpdatePageMedia(userId, item.id, fields);
      onSaved({ ...item, ...(res.data.data ?? { caption: fields.caption || null, alt: fields.alt || null }), id: item.id });
      message.success("Details saved");
    } catch (err) {
      message.error(showFieldError(form, err) || apiErrorMessage(err) || "Couldn't save the details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={item.kind === "video" ? "Video details" : "Photo details"}
      okText="Save"
      onOk={() => form.submit()}
      confirmLoading={saving}
      onCancel={onClose}
      destroyOnHidden
    >
      {picture && <img src={picture} alt="" className={styles.detailsPicture} />}
      <Form<DetailsValues>
        form={form}
        layout="vertical"
        initialValues={{ caption: item.caption ?? "", alt: item.alt ?? "" }}
        onFinish={save}
      >
        <Form.Item name="caption" label="Caption" extra="Shown with it on the page. Empty: none.">
          <Input maxLength={TEXT_MAX} showCount />
        </Form.Item>
        <Form.Item
          name="alt"
          label="Alt text"
          extra="What it shows, for people who can't see it. Screen readers and search engines read it."
        >
          <Input maxLength={TEXT_MAX} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface TileProps {
  item: PageMediaItem;
  index: number;
  count: number;
  onPage: boolean;
  locked: boolean;
  working: boolean;
  dropTarget: boolean;
  dragProps: React.HTMLAttributes<HTMLLIElement>;
  onMove: (to: number) => void;
  onHide: (hidden: boolean) => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

const MediaTile = ({
  item,
  index,
  count,
  onPage,
  locked,
  working,
  dropTarget,
  dragProps,
  onMove,
  onHide,
  onEdit,
  onDelete,
}: TileProps) => {
  const picture = pictureOf(item);
  const name = `${nameOf(item)} ${index + 1}`;
  const source = SOURCE_LABEL[item.source];
  const className = [
    styles.mediaTile,
    item.is_hidden ? styles.mediaHidden : "",
    dropTarget ? styles.dropTarget : "",
    locked ? "" : styles.draggable,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li {...dragProps} className={className} aria-label={`${name[0].toUpperCase()}${name.slice(1)}`}>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        className={styles.mediaPicture}
        title={item.kind === "video" ? "Play the video in a new tab" : "Open the photo in a new tab"}
      >
        {picture ? (
          <img src={picture} alt={item.alt || item.caption || ""} draggable={false} loading="lazy" />
        ) : (
          <span className={styles.mediaNoPicture}>
            {item.kind === "video" ? <VideoCameraAddOutlined /> : <PictureOutlined />}
          </span>
        )}
        {item.kind === "video" && (
          <span className={styles.mediaPlay}>
            <PlayCircleFilled />
          </span>
        )}
      </a>
      <div className={styles.mediaTags}>
        {onPage && <Tag color="green">On the page</Tag>}
        {item.is_hidden && (
          <Tag icon={<EyeInvisibleOutlined />} className={styles.hiddenTag}>
            Hidden
          </Tag>
        )}
        {item.from_card && <Tag color="purple">From the Access card</Tag>}
        {source && <Tag color="geekblue">{source}</Tag>}
      </div>
      <div className={styles.mediaBody}>
        <div className={item.caption ? styles.mediaCaption : `${styles.mediaCaption} ${styles.muted}`} title={item.caption ?? undefined}>
          {item.caption || "No caption"}
        </div>
        {item.is_hidden && <div className={styles.mediaNote}>Not on the page: hidden by an admin.</div>}
        <div className={styles.mediaActions}>
          <Space.Compact size="small">
            <Tooltip title="Move earlier">
              <Button
                icon={<ArrowLeftOutlined />}
                aria-label={`Move ${name} earlier`}
                disabled={locked || index === 0}
                onClick={() => onMove(index - 1)}
              />
            </Tooltip>
            <Tooltip title="Move later">
              <Button
                icon={<ArrowRightOutlined />}
                aria-label={`Move ${name} later`}
                disabled={locked || index >= count - 1}
                onClick={() => onMove(index + 1)}
              />
            </Tooltip>
          </Space.Compact>
          <Space size={4}>
            <Button
              size="small"
              icon={item.is_hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              aria-label={`${item.is_hidden ? "Show" : "Hide"} ${name}`}
              loading={working}
              disabled={locked}
              onClick={() => onHide(!item.is_hidden)}
            >
              {item.is_hidden ? "Show" : "Hide"}
            </Button>
            <Tooltip title="Caption and alt text">
              <Button size="small" icon={<EditOutlined />} aria-label={`Edit ${name}`} onClick={onEdit} />
            </Tooltip>
            <Popconfirm
              title={`Delete this ${nameOf(item)}?`}
              description={
                item.from_card
                  ? "It comes off the page. The Access card keeps its own copy."
                  : "It comes off the page for good. To keep it but not show it, hide it instead."
              }
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Keep it"
              onConfirm={onDelete}
            >
              <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Delete ${name}`} disabled={locked} />
            </Popconfirm>
          </Space>
        </div>
      </div>
    </li>
  );
};

interface MediaTabProps {
  userId: number;
  /** The account has a live Access card: its gallery shows until the page has media, and can be imported. */
  hasCard: boolean;
}

/**
 * A page's Media & Images (GET /profiles/admin/:userId/media and the calls beside it): every photo and video, hidden
 * ones too, in the page's order, with hiding, captions, reordering, deleting and adding. No limit on any plan.
 */
const MediaTab = ({ userId, hasCard }: MediaTabProps) => {
  const [items, setItems] = useState<PageMediaItem[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [working, setWorking] = useState<number | null>(null);
  const [addingLink, setAddingLink] = useState(false);
  const [editing, setEditing] = useState<PageMediaItem | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let current = true;
    loadAll((params) => GetPageMedia(userId, params).then((res) => res.data.data))
      .then((rows) => {
        if (!current) return;
        setItems(rows);
        setLoad({ status: "ready" });
      })
      .catch((err) => {
        console.error("Error loading the page's media:", err);
        if (current) setLoad({ status: "error", message: apiErrorMessage(err) || "Couldn't load the page's media" });
      });
    return () => {
      current = false;
    };
  }, [userId, reloadKey]);

  const saveOrder = useCallback((ids: number[]) => OrderPageMedia(userId, ids), [userId]);
  const orderFailed = useCallback(
    (err: unknown) => {
      message.error(apiErrorMessage(err) || "Couldn't save the new order");
      // Back to the order the API kept.
      refresh();
    },
    [refresh],
  );
  const order = useOrderSaver(saveOrder, orderFailed);
  const locked = busy !== null;

  const move = (from: number, to: number) => {
    const next = moveItem(items, from, to);
    if (next === items) return;
    setItems(next);
    order.schedule(next.map((item) => item.id));
  };

  const uploadPhotos = async (picked: File[]) => {
    const pictures = picked.filter((file) => file.type.startsWith("image/"));
    if (pictures.length < picked.length) message.warning("Only photos go here: the other files were left out.");
    const files = pictures.filter((file) => file.size <= MAX_UPLOAD_BYTES);
    if (files.length < pictures.length) {
      message.warning(`${plural(pictures.length - files.length, "photo")} over ${MAX_UPLOAD_MB} MB left out.`);
    }
    if (!files.length) return;
    const label = `Uploading ${plural(files.length, "photo")}`;
    let done = 0;
    try {
      // At most 20 a request.
      for (const batch of chunk(files, IMAGE_BATCH)) {
        const form = new FormData();
        batch.forEach((file) => form.append("images", file));
        setBusy({ label, percent: Math.round((done / files.length) * 100) });
        await AddPageMediaFiles(userId, form, (fraction) =>
          setBusy({ label, percent: Math.round(((done + fraction * batch.length) / files.length) * 100) }),
        );
        done += batch.length;
      }
      message.success(`${plural(done, "photo")} added to the page`);
    } catch (err) {
      const reason = apiErrorMessage(err) || "the upload failed";
      message.error(done ? `${plural(done, "photo")} added; the rest didn't upload: ${reason}` : `Couldn't upload the photos: ${reason}`);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const uploadVideos = async (picked: File[]) => {
    const mp4s = picked.filter(isMp4);
    if (mp4s.length < picked.length) message.warning("Videos must be MP4 files: the others were left out.");
    const files = mp4s.filter((file) => file.size <= MAX_UPLOAD_BYTES);
    if (files.length < mp4s.length) message.warning(`${plural(mp4s.length - files.length, "video")} over ${MAX_UPLOAD_MB} MB left out.`);
    if (!files.length) return;
    let added = 0;
    try {
      // One video a request, each with a poster made here.
      for (const [i, file] of files.entries()) {
        const label = files.length > 1 ? `Video ${i + 1} of ${files.length}` : "The video";
        setBusy({ label: `${label}: making its poster`, percent: null });
        let poster: File;
        try {
          poster = await videoPoster(file);
        } catch {
          message.error(`Couldn't read “${file.name}”. Try exporting it again as an MP4.`);
          continue;
        }
        const form = new FormData();
        form.append("videos", file);
        form.append("video_thumbnails", poster);
        setBusy({ label: `${label}: uploading`, percent: 0 });
        await AddPageMediaFiles(userId, form, (fraction) =>
          setBusy({ label: `${label}: uploading`, percent: Math.round(fraction * 100) }),
        );
        added++;
      }
    } catch (err) {
      message.error(apiErrorMessage(err) || "Couldn't upload the video");
    } finally {
      setBusy(null);
      if (added) message.success(`${plural(added, "video")} added to the page`);
      refresh();
    }
  };

  const importCard = async () => {
    setBusy({ label: "Copying the Access card's gallery", percent: null });
    try {
      const res = await ImportPageCardMedia(userId);
      const added = res.data.data?.rows?.length ?? 0;
      message.success(
        added ? `${plural(added, "item")} copied from the Access card` : "Everything in the Access card's gallery is here already",
      );
    } catch (err) {
      message.error(apiErrorMessage(err) || "Couldn't import the Access card's photos");
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const setHidden = async (item: PageMediaItem, hidden: boolean) => {
    setWorking(item.id);
    try {
      const res = await UpdatePageMedia(userId, item.id, { is_hidden: hidden });
      setItems((list) =>
        list.map((row) => (row.id === item.id ? { ...row, ...(res.data.data ?? { is_hidden: hidden }), id: row.id } : row)),
      );
      message.success(hidden ? `The ${nameOf(item)} is hidden from the page` : `The ${nameOf(item)} shows on the page again`);
    } catch (err) {
      message.error(apiErrorMessage(err) || `Couldn't ${hidden ? "hide" : "show"} the ${nameOf(item)}`);
      if (apiErrorStatus(err) === 404) refresh();
    } finally {
      setWorking(null);
    }
  };

  const remove = async (item: PageMediaItem) => {
    setWorking(item.id);
    try {
      await DeletePageMedia(userId, item.id);
      setItems((list) => list.filter((row) => row.id !== item.id));
      message.success(`The ${nameOf(item)} is deleted`);
    } catch (err) {
      message.error(apiErrorMessage(err) || `Couldn't delete the ${nameOf(item)}`);
      if (apiErrorStatus(err) === 404) refresh();
    } finally {
      setWorking(null);
    }
  };

  const tileDrag = (index: number): React.HTMLAttributes<HTMLLIElement> =>
    locked
      ? {}
      : {
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
        };

  const pickFiles = (input: HTMLInputElement | null) => input?.click();
  const filesOf = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    return files;
  };

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

  const hiddenCount = items.filter((item) => item.is_hidden).length;
  // The page shows the first few items that aren't hidden.
  const onPage = new Set(
    items
      .filter((item) => !item.is_hidden)
      .slice(0, SHOWN_ON_PAGE)
      .map((item) => item.id),
  );

  return (
    <div>
      <div className={styles.contentHead}>
        <p className={styles.contentIntro}>
          The photos and videos in the page's Media & Images, hidden ones too, in the page's order. There's no limit on
          any plan (the Access card's gallery keeps its plan's). What the owner adds shows at once; hide what shouldn't.
        </p>
        <Space wrap>
          <Button type="primary" icon={<UploadOutlined />} disabled={locked} onClick={() => pickFiles(photoInput.current)}>
            Upload photos
          </Button>
          <Button icon={<VideoCameraAddOutlined />} disabled={locked} onClick={() => pickFiles(videoInput.current)}>
            Upload videos
          </Button>
          <Button icon={<LinkOutlined />} disabled={locked} onClick={() => setAddingLink(true)}>
            Add a YouTube or Vimeo link
          </Button>
          <Tooltip title={hasCard ? "" : "The account has no live Access card"}>
            <Button icon={<ImportOutlined />} disabled={locked || !hasCard} onClick={importCard}>
              Import Access card photos
            </Button>
          </Tooltip>
        </Space>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Photos to upload"
          onChange={(event) => {
            const files = filesOf(event);
            if (files.length) void uploadPhotos(files);
          }}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/mp4,.mp4"
          multiple
          hidden
          aria-label="MP4 videos to upload"
          onChange={(event) => {
            const files = filesOf(event);
            if (files.length) void uploadVideos(files);
          }}
        />
        <div className={styles.hint}>
          Photos: as many as you like at once. Videos: MP4, up to {MAX_UPLOAD_MB} MB each; a poster is made from a frame.
        </div>
      </div>

      {busy && (
        <div className={styles.busy} role="status">
          <span>{busy.label}</span>
          {busy.percent === null ? <Spin size="small" /> : <Progress percent={busy.percent} size="small" status="active" />}
        </div>
      )}

      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div className={styles.emptyText}>
              <strong>No media of its own yet.</strong>
              <p>
                {hasCard
                  ? "Until some is added, the page shows its Access card's gallery. "
                  : "The page shows no Media & Images until some is added. "}
                There's no limit: add as many photos and videos as you like.
              </p>
              {hasCard && (
                <p>
                  The first add copies the Access card's photos in too, so they can be kept, reordered, hidden or
                  deleted here.
                </p>
              )}
            </div>
          }
        />
      ) : (
        <>
          <div className={styles.listSummary}>
            <span>
              {plural(items.length, "item")}
              {hiddenCount > 0 && `, ${hiddenCount} hidden`}. The first {SHOWN_ON_PAGE} that aren't hidden show on the page,
              the rest under "View all". Drag to reorder, or use the arrows.
            </span>
            {order.status !== "idle" && (
              <span className={styles.muted} role="status">
                {ORDER_WORDS[order.status]}
              </span>
            )}
          </div>
          {hiddenCount === items.length && (
            <Alert
              type="info"
              showIcon
              className={styles.block}
              title={
                hasCard
                  ? "Everything here is hidden, so the page shows its Access card's gallery instead."
                  : "Everything here is hidden, so the page shows no Media & Images."
              }
            />
          )}
          <ul className={styles.mediaGrid}>
            {items.map((item, index) => (
              <MediaTile
                key={item.id}
                item={item}
                index={index}
                count={items.length}
                onPage={onPage.has(item.id)}
                locked={locked}
                working={working === item.id}
                dropTarget={dropAt === index}
                dragProps={tileDrag(index)}
                onMove={(to) => move(index, to)}
                onHide={(hidden) => setHidden(item, hidden)}
                onEdit={() => setEditing(item)}
                onDelete={() => remove(item)}
              />
            ))}
          </ul>
        </>
      )}

      {addingLink && (
        <LinkModal
          userId={userId}
          onClose={() => setAddingLink(false)}
          onAdded={() => {
            setAddingLink(false);
            refresh();
          }}
        />
      )}
      {editing && (
        <DetailsModal
          key={editing.id}
          userId={userId}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setItems((list) => list.map((row) => (row.id === saved.id ? saved : row)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

export default MediaTab;
