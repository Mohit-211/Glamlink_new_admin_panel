import React, { useEffect, useRef, useState } from "react";
import { Select, Space, Tag } from "antd";
import AccountSelect from "../../components/AccountSelect";
import { GetAllJournal, GetAllShop } from "../../services/Api/JournalApi";
import { GetVideos } from "../../services/Api/VideoApi";
import type { TopicItemType } from "../../types/topic";
import { KIND } from "./topicItems";

/** Something that can go on the topic, as the picker shows it. */
interface Choice {
  id: number;
  title: string;
  status: string | null;
  detail: string | null;
}

/** Every article or product (the admin lists answer them all), or the videos matching a search. */
const loaders: Partial<Record<TopicItemType, (search: string) => Promise<Choice[]>>> = {
  article: async () => {
    const rows = (await GetAllJournal())?.data?.rows ?? [];
    return rows.map((j) => ({ id: Number(j.id), title: j.title, status: j.status ?? null, detail: j.journal_category?.title ?? null }));
  },
  product: async () => {
    const rows = (await GetAllShop())?.data?.rows ?? [];
    return rows.map((s) => ({ id: Number(s.id), title: s.title ?? `Product #${s.id}`, status: s.status ?? null, detail: s.brand ?? null }));
  },
  video: async (search) => {
    const rows = (await GetVideos({ search: search || undefined, limit: 50 })).data.data.rows;
    return rows.map((v) => ({ id: Number(v.id), title: v.title, status: v.status, detail: v.series?.name ?? null }));
  },
};

interface TopicItemPickerProps {
  type: TopicItemType;
  value: number[];
  onChange: (ids: number[]) => void;
  /** On the topic already: not offered again. */
  exclude: number[];
  disabled?: boolean;
}

/**
 * Picks items of one kind to put on a topic. Professionals and brands come from the pages list (AccountSelect);
 * articles and products load whole once and filter as you type; videos are searched on the server.
 */
const TopicItemPicker = ({ type, value, onChange, exclude, disabled }: TopicItemPickerProps) => {
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const known = useRef(new Map<number, Choice>());
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (type === "professional" || type === "brand") {
    return (
      <AccountSelect
        mode="multiple"
        type={type === "brand" ? "brand" : "individual"}
        value={value}
        onChange={onChange}
        exclude={exclude}
        disabled={disabled}
        placeholder={`Search ${KIND[type].many.toLowerCase()} to add`}
        aria-label={`${KIND[type].many} to add`}
      />
    );
  }

  const serverSearch = type === "video";
  const load = async (search: string) => {
    const call = ++latest.current;
    setLoading(true);
    try {
      const rows = await loaders[type]!(search);
      if (call !== latest.current) return;
      rows.forEach((row) => known.current.set(row.id, row));
      setChoices(rows);
    } catch (err) {
      console.error(`Couldn't load the ${KIND[type].many.toLowerCase()}:`, err);
      if (call === latest.current) setChoices([]);
    } finally {
      if (call === latest.current) setLoading(false);
    }
  };

  const offered = (choices ?? []).filter((choice) => !exclude.includes(choice.id) || value.includes(choice.id));
  // The picked ones keep their labels while a new search shows other videos.
  const picked = value.filter((id) => !offered.some((c) => c.id === id)).map((id) => known.current.get(id));
  const options = [...offered, ...picked.filter((c): c is Choice => Boolean(c))].map((choice) => ({
    value: choice.id,
    label: choice.title,
    choice,
  }));

  return (
    <Select<number[], (typeof options)[number]>
      mode="multiple"
      value={value}
      onChange={(ids) => onChange(ids ?? [])}
      options={options}
      loading={loading}
      disabled={disabled}
      allowClear
      placeholder={`Search ${KIND[type].many.toLowerCase()} to add`}
      aria-label={`${KIND[type].many} to add`}
      style={{ width: "100%" }}
      onOpenChange={(open) => {
        if (open && choices === null) load("");
      }}
      showSearch={
        serverSearch
          ? {
              filterOption: false,
              onSearch: (term) => {
                clearTimeout(timer.current);
                timer.current = setTimeout(() => load(term.trim()), 300);
              },
            }
          : { optionFilterProp: "label" }
      }
      notFoundContent={loading ? "Loading…" : `No ${KIND[type].one} found`}
      optionRender={(option) => {
        const { choice } = option.data;
        return (
          <Space size={6}>
            <span>{choice.title}</span>
            {choice.detail && <span style={{ color: "var(--color-text-tertiary)" }}>{choice.detail}</span>}
            {choice.status === "draft" && <Tag color="gold">Draft</Tag>}
          </Space>
        );
      }}
    />
  );
};

export default TopicItemPicker;
