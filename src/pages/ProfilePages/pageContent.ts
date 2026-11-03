import { useCallback, useRef, useState } from "react";
import dayjs from "dayjs";
import type { Paged } from "../../types/api";

// What the Media & Images and Education tabs share (the API of Nov 3, as the website's owner tabs use it): both lists
// load whole, since a new order is saved as every id at once.

/** The API refuses files over this (`UPLOAD_MAX_MB`), so they are left out here first. */
export const MAX_UPLOAD_MB = 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** POST .../media takes at most 20 photos a request. */
export const IMAGE_BATCH = 20;

/** The most the admin lists answer a page. */
const PAGE_LIMIT = 100;
/** A stop for an API that ignores `page`: 5,000 rows. */
const MAX_PAGES = 50;

/**
 * Every row of a paged list, in the API's order. `count` is the total, so pages are asked for until they are all in
 * (or a page adds nothing new).
 */
export const loadAll = async <T extends { id: number }>(
  fetchPage: (params: { page: number; limit: number }) => Promise<Paged<T> | undefined>,
): Promise<T[]> => {
  const rows: T[] = [];
  const seen = new Set<number>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const answer = await fetchPage({ page, limit: PAGE_LIMIT });
    const batch = Array.isArray(answer?.rows) ? answer.rows : [];
    let added = 0;
    for (const row of batch) {
      // An id may come as a string (BIGINT); the order is saved as numbers.
      const id = Number(row?.id);
      if (!row || !Number.isFinite(id) || seen.has(id)) continue;
      seen.add(id);
      rows.push(row.id === id ? row : { ...row, id });
      added++;
    }
    if (!added || rows.length >= Number(answer?.count ?? 0)) break;
  }
  return rows;
};

/** The list with one item moved; the same list when the move goes nowhere. */
export const moveItem = <T>(list: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const chunk = <T>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

export const isMp4 = (file: File) => file.type === "video/mp4" || /\.mp4$/i.test(file.name);

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export const shortDate = (date: string | null | undefined) => (date && dayjs(date).isValid() ? dayjs(date).format("MMM D, YYYY") : "");

/**
 * A YouTube or Vimeo link, made absolute ("youtu.be/…" gets https://); null for anything else. The API reads the
 * video's id from it and has the last word.
 */
export const videoLink = (raw: string): string | null => {
  const text = raw.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  return ["youtube.com", "youtu.be", "vimeo.com", "player.vimeo.com"].includes(host) ? url.toString() : null;
};

export type OrderStatus = "idle" | "saving" | "saved";

/**
 * Saves a new order as soon as it changes, one request at a time: while one is on its way, only the newest order
 * waits behind it. A failure calls `onFailed` (the tab reloads the list, so it shows the order the API kept).
 */
export const useOrderSaver = (save: (ids: number[]) => Promise<unknown>, onFailed: (error: unknown) => void) => {
  const [status, setStatus] = useState<OrderStatus>("idle");
  const inFlight = useRef(false);
  const queued = useRef<number[] | null>(null);

  const run = useCallback(
    async (ids: number[]) => {
      inFlight.current = true;
      setStatus("saving");
      let next: number[] | null = ids;
      while (next) {
        const current: number[] = next;
        queued.current = null;
        try {
          await save(current);
        } catch (error) {
          queued.current = null;
          inFlight.current = false;
          setStatus("idle");
          onFailed(error);
          return;
        }
        next = queued.current;
      }
      inFlight.current = false;
      setStatus("saved");
    },
    [save, onFailed],
  );

  const schedule = useCallback(
    (ids: number[]) => {
      if (inFlight.current) queued.current = ids;
      else void run(ids);
    },
    [run],
  );

  return { schedule, status };
};

export const ORDER_WORDS: Record<OrderStatus, string> = { idle: "", saving: "Saving the order…", saved: "Order saved" };
