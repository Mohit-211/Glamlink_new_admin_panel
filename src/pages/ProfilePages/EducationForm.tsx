import React, { useEffect, useRef, useState } from "react";
import { Button, Form, Input, Progress, Radio, message } from "antd";
import { PlayCircleFilled, UploadOutlined, VideoCameraOutlined } from "@ant-design/icons";
import ImageUploadField from "../../components/ImageUploadField";
import RichTextEditor from "../../components/RichTextEditor";
import { CreatePageEducation, UpdatePageEducation, UploadPageImage } from "../../services/Api/ProfilesApi";
import { apiErrorMessage } from "../../utils/apiError";
import { showFieldError } from "../../utils/formErrors";
import { htmlToText } from "../../utils/sanitizeHtml";
import { videoPoster } from "../../utils/videoPoster";
import type { EducationVideo, PageEducationItem } from "../../types/profile";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, isMp4, videoLink } from "./pageContent";
import styles from "./ProfilePages.module.scss";

// One Education post, new or edited (POST and PUT /profiles/admin/:userId/education): a video (a YouTube or Vimeo
// link, or an MP4 with a poster made here) or an article written in the editor's article mode, whose pictures go
// through POST /profiles/admin/:userId/uploads. An edit is partial: what didn't change isn't sent.

const LIMITS = { title: 150, summary: 300 } as const;

type Kind = PageEducationItem["kind"];
type Status = PageEducationItem["status"];

/** An MP4 picked here, with the poster made from it. */
interface PickedVideo {
  file: File;
  poster: File;
  preview: string;
}

interface EducationValues {
  kind: Kind;
  title: string;
  summary: string;
  status: Status;
  videoMode: "link" | "upload";
  video_url: string;
  /** null: no new file (an edit keeps its video). */
  videos: PickedVideo | null;
  /** The post's own cover link; "" for none. */
  cover_image: string;
  body: string;
}

/** The post's own cover: a video's `cover_image` falls back to its thumbnail, which isn't one. */
const ownCover = (item: PageEducationItem | null) => {
  if (!item?.cover_image) return "";
  if (item.kind === "video" && item.video?.thumbnail && item.cover_image === item.video.thumbnail) return "";
  return item.cover_image;
};

const linkOf = (item: PageEducationItem | null) =>
  item?.kind === "video" && item.video && item.video.source !== "upload" ? item.video.url : "";

const valuesOf = (item: PageEducationItem | null): EducationValues => ({
  kind: item?.kind === "article" ? "article" : "video",
  title: item?.title ?? "",
  summary: item?.summary ?? "",
  status: item?.status === "draft" ? "draft" : "published",
  videoMode: item?.video?.source === "upload" ? "upload" : "link",
  video_url: linkOf(item),
  videos: null,
  cover_image: ownCover(item),
  body: item?.body ?? "",
});

/** An article with something to read: text, or at least a picture. */
const hasText = (html: string) => Boolean(htmlToText(html).trim()) || /<img\s/i.test(html);

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

interface VideoFileFieldProps {
  value?: PickedVideo | null;
  onChange?: (value: PickedVideo | null) => void;
  /** The post's uploaded video, kept unless another is picked. */
  current: EducationVideo | null;
  onPreparing: (preparing: boolean) => void;
}

/** An MP4 for the post, with its poster made from a frame in the browser. */
const VideoFileField = ({ value, onChange, current, onPreparing }: VideoFileFieldProps) => {
  const form = Form.useFormInstance<EducationValues>();
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  // The poster's preview is a blob: let it go when another is picked or the form closes.
  useEffect(() => () => (value ? URL.revokeObjectURL(value.preview) : undefined), [value]);

  const fail = (problem: string) => form.setFields([{ name: "videos", errors: [problem] }]);

  const pick = async (file: File) => {
    if (!isMp4(file)) return fail("Videos must be MP4 files.");
    if (file.size > MAX_UPLOAD_BYTES) return fail(`Videos can be at most ${MAX_UPLOAD_MB} MB.`);
    setPreparing(true);
    onPreparing(true);
    try {
      const poster = await videoPoster(file);
      onChange?.({ file, poster, preview: URL.createObjectURL(poster) });
    } catch {
      fail("This video can't be read. Try exporting it again as an MP4.");
    } finally {
      setPreparing(false);
      onPreparing(false);
    }
  };

  const shown = value?.preview || current?.thumbnail || null;
  return (
    <div className={styles.videoPick}>
      <div className={styles.videoPoster}>
        {shown ? <img src={shown} alt="" /> : <VideoCameraOutlined />}
        {shown && (
          <span className={styles.mediaPlay}>
            <PlayCircleFilled />
          </span>
        )}
      </div>
      <div>
        <Button icon={<UploadOutlined />} loading={preparing} onClick={() => input.current?.click()}>
          {value || current ? "Choose another video" : "Choose an MP4"}
        </Button>
        <div className={styles.hint}>
          {preparing
            ? "Making a poster from the video…"
            : value
              ? `${value.file.name} (${megabytes(value.file.size)}). Its poster is a frame from it.`
              : current
                ? "The current video stays unless another is chosen."
                : `MP4, up to ${MAX_UPLOAD_MB} MB. Its poster is made from a frame.`}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="video/mp4,.mp4"
        hidden
        aria-label="MP4 video"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void pick(file);
        }}
      />
    </div>
  );
};

interface EducationFormProps {
  userId: number;
  /** The post with its `body` (GET .../education/:id), or null for a new one. */
  editing: PageEducationItem | null;
  onSaved: (item: PageEducationItem) => void;
  onCancel: () => void;
}

const EducationForm = ({ userId, editing, onSaved, onCancel }: EducationFormProps) => {
  const [form] = Form.useForm<EducationValues>();
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const kind = Form.useWatch("kind", form) ?? valuesOf(editing).kind;
  const videoMode = Form.useWatch("videoMode", form) ?? valuesOf(editing).videoMode;
  const status = Form.useWatch("status", form) ?? valuesOf(editing).status;

  const initial = valuesOf(editing);
  const currentUpload = editing?.kind === "video" && editing.video?.source === "upload" ? editing.video : null;

  const save = async (values: EducationValues) => {
    const fields = new FormData();
    fields.append("kind", values.kind);
    fields.append("title", values.title.trim());
    fields.append("summary", values.summary.trim());
    fields.append("status", values.status);
    // An unchanged article stays as it is: the edit is partial.
    if (values.kind === "article" && (editing?.kind !== "article" || values.body !== (editing.body ?? ""))) {
      fields.append("body", values.body);
    }
    if (values.kind === "video") {
      if (values.videoMode === "link") {
        // Kept as it is unless the link changed.
        if (!linkOf(editing) || values.video_url.trim() !== linkOf(editing)) {
          fields.append("video_url", videoLink(values.video_url) ?? values.video_url.trim());
        }
      } else if (values.videos) {
        fields.append("videos", values.videos.file);
        fields.append("video_thumbnails", values.videos.poster);
      }
    }
    // A new cover link, or "" to remove the post's own.
    if (values.cover_image !== initial.cover_image) fields.append("cover_image", values.cover_image);

    const uploading = values.kind === "video" && values.videoMode === "upload" && Boolean(values.videos);
    setSaving(true);
    setProgress(uploading ? 0 : null);
    try {
      const onProgress = uploading ? (fraction: number) => setProgress(Math.round(fraction * 100)) : undefined;
      const res = editing
        ? await UpdatePageEducation(userId, editing.id, fields, onProgress)
        : await CreatePageEducation(userId, fields, onProgress);
      message.success(
        values.status === "draft" ? "Draft saved" : editing ? "Post saved" : "Post published on the page",
      );
      onSaved(res.data.data);
    } catch (err) {
      // The API's names, as this form names them.
      const video = values.videoMode === "link" ? "video_url" : "videos";
      const fieldError = showFieldError(form, err, {
        images: "cover_image",
        video_url: video,
        videos: video,
        video_thumbnails: video,
      });
      message.error(fieldError || apiErrorMessage(err) || "Couldn't save the post");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <Form<EducationValues>
      form={form}
      layout="vertical"
      initialValues={initial}
      onFinish={save}
      scrollToFirstError
      className={styles.educationForm}
    >
      <h4 className={styles.sectionTitle}>{editing ? `Edit “${editing.title}”` : "New post"}</h4>
      <Form.Item name="kind" label="Kind">
        <Radio.Group
          optionType="button"
          options={[
            { label: "Video", value: "video" },
            { label: "Article", value: "article" },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="title"
        label="Title"
        rules={[{ required: true, whitespace: true, message: "Give the post a title" }]}
        extra="A new title gives the post a new address."
      >
        <Input maxLength={LIMITS.title} showCount />
      </Form.Item>
      <Form.Item name="summary" label="Summary" extra="A line or two on the post's card. Optional.">
        <Input.TextArea maxLength={LIMITS.summary} showCount autoSize={{ minRows: 2, maxRows: 5 }} />
      </Form.Item>

      {kind === "video" && (
        <Form.Item label="Video" required>
          <Form.Item name="videoMode" className={styles.videoMode}>
            <Radio.Group
              options={[
                { label: "YouTube or Vimeo link", value: "link" },
                { label: "Upload an MP4", value: "upload" },
              ]}
            />
          </Form.Item>
          {videoMode === "link" ? (
            <Form.Item
              name="video_url"
              rules={[
                { required: true, whitespace: true, message: "Paste the video's link" },
                {
                  validator: async (_, value: string | undefined) => {
                    if (value?.trim() && !videoLink(value)) throw new Error("Paste a link to a video on YouTube or Vimeo");
                  },
                },
              ]}
            >
              <Input placeholder="https://www.youtube.com/watch?v=…" autoComplete="off" aria-label="Video link" />
            </Form.Item>
          ) : (
            <Form.Item
              name="videos"
              rules={[
                {
                  validator: async (_, value: PickedVideo | null | undefined) => {
                    if (!value && !currentUpload) throw new Error("Choose an MP4 video");
                  },
                },
              ]}
            >
              <VideoFileField current={currentUpload} onPreparing={setPreparing} />
            </Form.Item>
          )}
        </Form.Item>
      )}

      <Form.Item
        name="cover_image"
        label="Cover image"
        extra={
          kind === "video"
            ? "On the post's card, cropped 16:9. Empty: the video's thumbnail."
            : "On the post's card and at the top of the article, cropped 16:9."
        }
      >
        <ImageUploadField aspect={16 / 9} previewWidth={240} />
      </Form.Item>

      {kind === "article" && (
        <Form.Item
          name="body"
          label="Article"
          dependencies={["status"]}
          rules={[
            ({ getFieldValue }) => ({
              validator: async (_, value: string | undefined) => {
                if (getFieldValue("status") === "published" && !hasText(value ?? "")) {
                  throw new Error("Write the article before publishing it, or save it as a draft");
                }
              },
            }),
          ]}
          extra="Headings, bold and italic, lists, quotes, links and pictures: what the website keeps."
        >
          <RichTextEditor article height={320} uploadMedia={(file, options) => UploadPageImage(userId, file, options)} />
        </Form.Item>
      )}

      <Form.Item name="status" label="Status">
        <Radio.Group
          options={[
            { label: "Published: on the page", value: "published" },
            { label: "Draft: only here", value: "draft" },
          ]}
        />
      </Form.Item>

      {saving && progress !== null && <Progress percent={progress} size="small" status="active" />}

      <div className={styles.formActions}>
        <Button type="primary" htmlType="submit" loading={saving} disabled={preparing}>
          {editing ? "Save post" : status === "draft" ? "Save draft" : "Publish post"}
        </Button>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </Form>
  );
};

export default EducationForm;
