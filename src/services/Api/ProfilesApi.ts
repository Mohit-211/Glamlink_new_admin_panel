import axios from "axios";
import { BASE_URL } from "../Host";
import type { ApiResponse, Paged } from "../../types/api";
import type {
  PageAnalytics,
  PageEducationItem,
  PageListParams,
  PageMediaItem,
  PageMediaUpdate,
  PageRow,
  PageUpdate,
  PageView,
  TaggedArticle,
  TaggedVideo,
} from "../../types/profile";

// Professional and brand pages. Every call takes the account's id; a refusal is 400 INVALID_PAGE with `details.field`.

type Id = number | string;

/** One page of a paged list: `limit` at most 100 for a page's media and education. */
export interface PageParams {
  page?: number;
  limit?: number;
}

/** A file upload's progress, from 0 to 1. */
type Progress = (fraction: number) => void;

const progressOf = (onProgress?: Progress) =>
  onProgress
    ? {
        onUploadProgress: (event: { loaded: number; total?: number }) => {
          if (event.total) onProgress(Math.min(1, event.loaded / event.total));
        },
      }
    : {};

/** Every page, by name: listed or not, with how each stands. */
export const GetPages = async ({ featured, ...params }: PageListParams = {}) => {
  return axios.get<ApiResponse<Paged<PageRow>>>(`${BASE_URL}profiles/admin/list`, {
    params: { ...params, ...(featured ? { featured: "true" } : {}) },
  });
};

/** One account's page: what is set on it, whether it shows (and why not), and what the public sees. 404 NOT_FOUND. */
export const GetPage = async (userId: Id) => {
  return axios.get<ApiResponse<PageView>>(`${BASE_URL}profiles/admin/${userId}`);
};

/** Saves the fields sent. A new slug must be free. */
export const UpdatePage = async (userId: Id, fields: PageUpdate) => {
  return axios.put<ApiResponse<PageView>>(`${BASE_URL}profiles/admin/${userId}`, fields);
};

/**
 * A brand page for a brand with no login yet: its account has no password, and the page shows without a card.
 * 409 ACCOUNT_EXISTS (`details.user_id`) when the email has an account: edit that account's page instead.
 */
export const CreateBrandPage = async (fields: PageUpdate & { name: string; email: string }) => {
  return axios.post<ApiResponse<PageView>>(`${BASE_URL}profiles/admin/brands`, fields);
};

/** Emails the account a "Set your password" link (valid 7 days). 409 ALREADY_CLAIMED once it has a password. */
export const SendPageInvite = async (userId: Id) => {
  return axios.post<ApiResponse<{ sent: boolean; email: string }>>(`${BASE_URL}profiles/admin/${userId}/invite`);
};

/** `from` / `to`: "YYYY-MM-DD", not in the future; today when left out. */
export const GetPageAnalytics = async (userId: Id, from?: string, to?: string) => {
  return axios.get<ApiResponse<PageAnalytics>>(`${BASE_URL}profiles/admin/${userId}/analytics`, {
    params: { from, to },
  });
};

// ---- Media & Images (Nov 3): any page's photos and videos, hidden ones too, in the page's order ----

const media = (userId: Id) => `${BASE_URL}profiles/admin/${userId}/media`;

/** `{ count, rows }`: `count` is every item, so page until all are in (24 a page by default, at most 100). */
export const GetPageMedia = async (userId: Id, params: PageParams = {}) => {
  return axios.get<ApiResponse<Paged<PageMediaItem>>>(media(userId), { params });
};

/**
 * Adds files: `images` (at most 20 a request), or `videos` (MP4) with their posters in `video_thumbnails`. They go
 * first on the page; the page's first add copies its card's gallery in before them. 201 `{ rows }`, the items added.
 */
export const AddPageMediaFiles = async (userId: Id, form: FormData, onProgress?: Progress) => {
  return axios.post<ApiResponse<{ rows: PageMediaItem[] }>>(media(userId), form, progressOf(onProgress));
};

/** Adds a YouTube or Vimeo video by its link. 400 with `details.field` "url" for any other link. */
export const AddPageMediaLink = async (userId: Id, link: { url: string; caption?: string }) => {
  return axios.post<ApiResponse<{ rows: PageMediaItem[] }>>(media(userId), link);
};

/** Copies the live card's gallery items the page lacks, after its own: `{ rows }`, the items added (maybe none). */
export const ImportPageCardMedia = async (userId: Id) => {
  return axios.post<ApiResponse<{ rows: PageMediaItem[] }>>(`${media(userId)}/import-card`);
};

/** Caption, alt text, and hiding (`is_hidden: true` keeps the item off the page). Answers the item. */
export const UpdatePageMedia = async (userId: Id, id: Id, fields: PageMediaUpdate) => {
  return axios.put<ApiResponse<PageMediaItem>>(`${media(userId)}/${id}`, fields);
};

/** The page's whole order: every item's id once, hidden ones too. */
export const OrderPageMedia = async (userId: Id, ids: number[]) => {
  return axios.put<ApiResponse<{ ok: boolean }>>(`${media(userId)}/order`, { ids });
};

/** Deletes the item; an upload's file goes too unless something else shows it (a card's file never does). */
export const DeletePageMedia = async (userId: Id, id: Id) => {
  return axios.delete<ApiResponse<{ deleted: boolean }>>(`${media(userId)}/${id}`);
};

// ---- Education (Nov 3): any page's videos and articles, drafts too, in the page's order ----

const education = (userId: Id) => `${BASE_URL}profiles/admin/${userId}/education`;

/** `{ count, rows }` without the articles' text (12 a page by default, at most 100). */
export const GetPageEducation = async (userId: Id, params: PageParams = {}) => {
  return axios.get<ApiResponse<Paged<PageEducationItem>>>(education(userId), { params });
};

/** One post with its `body`. */
export const GetPageEducationItem = async (userId: Id, id: Id) => {
  return axios.get<ApiResponse<PageEducationItem>>(`${education(userId)}/${id}`);
};

/**
 * A new post (a form: `kind`, `title`, `summary`, `status`, `body`, `video_url` or the files `videos` and
 * `video_thumbnails`, the cover as the file `images` or the link `cover_image`). It goes first on the page. 201, the
 * post with its `body`.
 */
export const CreatePageEducation = async (userId: Id, form: FormData, onProgress?: Progress) => {
  return axios.post<ApiResponse<PageEducationItem>>(education(userId), form, progressOf(onProgress));
};

/** The fields sent (a form, as for a new post), each optional. Answers the post with its `body`. */
export const UpdatePageEducation = async (userId: Id, id: Id, form: FormData, onProgress?: Progress) => {
  return axios.put<ApiResponse<PageEducationItem>>(`${education(userId)}/${id}`, form, progressOf(onProgress));
};

/** Publishes a post, or takes it off the page ("draft"). 400 on `body` for an article with no text. */
export const SetPageEducationStatus = async (userId: Id, id: Id, status: PageEducationItem["status"]) => {
  return axios.put<ApiResponse<PageEducationItem>>(`${education(userId)}/${id}`, { status });
};

/** The page's whole order: every post's id once, drafts too. */
export const OrderPageEducation = async (userId: Id, ids: number[]) => {
  return axios.put<ApiResponse<{ ok: boolean }>>(`${education(userId)}/order`, { ids });
};

export const DeletePageEducation = async (userId: Id, id: Id) => {
  return axios.delete<ApiResponse<{ deleted: boolean }>>(`${education(userId)}/${id}`);
};

/** One picture for an article's text (the file `images`); resolves its link. `onProgress` gets 0 to 100. */
export const UploadPageImage = async (
  userId: Id,
  file: File,
  { onProgress, signal }: { onProgress?: (percent: number) => void; signal?: AbortSignal } = {},
) => {
  const form = new FormData();
  form.append("images", file, file.name);
  const res = await axios.post<ApiResponse<{ location?: string }>>(`${BASE_URL}profiles/admin/${userId}/uploads`, form, {
    signal,
    ...progressOf(onProgress && ((fraction) => onProgress(Math.round(fraction * 100)))),
  });
  const location = res.data?.data?.location;
  if (!location) throw new Error("The API didn't answer the picture's link");
  return location;
};

// ---- Tagged in: the website's own lists of a page (public; they answer only for a visible page, else 404) ----

/** The published journal articles that feature the page, newest first (12 a page by default, at most 50). */
export const GetPageArticles = async (slug: string, params: PageParams = {}) => {
  return axios.get<ApiResponse<Paged<TaggedArticle>>>(`${BASE_URL}profiles/${encodeURIComponent(slug)}/articles`, {
    params,
  });
};

/** The published videos the page's account is in, newest first; `series` one series (beauty-vault-podcast). */
export const GetPageVideos = async (slug: string, params: PageParams & { series?: string } = {}) => {
  return axios.get<ApiResponse<Paged<TaggedVideo>>>(`${BASE_URL}profiles/${encodeURIComponent(slug)}/videos`, {
    params,
  });
};
