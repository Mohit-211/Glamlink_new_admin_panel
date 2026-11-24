import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Alert, Badge, Button, Empty, Spin, Tabs, message } from "antd";
import { EditOutlined, ExportOutlined } from "@ant-design/icons";
import PageHeader, { Panel } from "../../components/PageHeader";
import { GetJournalTopicById, GetJournalTopicParagraphs } from "../../services/Api/JournalApi";
import { GetTopicItems } from "../../services/Api/TopicsApi";
import { apiErrorMessage, apiErrorStatus } from "../../utils/apiError";
import { useIdParam } from "../../utils/routing";
import { websiteUrl } from "../../utils/website";
import type { JournalTopic, TopicParagraph } from "../../types/journal";
import type { TopicItems } from "../../types/topic";
import { shortDate } from "../ProfilePages/pageContent";
import { AiPanel } from "./TopicAi";
import TopicItemsTab from "./TopicItemsTab";
import { KINDS } from "./topicItems";
import styles from "./TopicScreen.module.scss";
import { paths } from "../../paths";

/** A tagged paragraph's text, from its article's HTML. */
const paragraphText = (content: string | null | undefined, paragraphId: string) => {
  if (!content) return "";
  try {
    const doc = new DOMParser().parseFromString(content, "text/html");
    // The editor's ids are letters, digits, _ and -: anything else can't be one.
    const safeId = paragraphId.replace(/[^\w-]/g, "");
    return doc.querySelector(`[data-paragraph-id="${safeId}"]`)?.textContent?.trim() ?? "";
  } catch {
    return "";
  }
};

/** Paragraphs of articles tagged with the topic (in the article editor's text). Read-only here. */
const ParagraphsTab = ({ paragraphs }: { paragraphs: TopicParagraph[] | null }) => {
  if (paragraphs === null) return <Spin />;
  if (!paragraphs.length) return <Empty description="No paragraph of any article is tagged with this topic" />;
  return (
    <div className={styles.tab}>
      <p className={styles.hint}>Tag a paragraph in the article editor: select it, click Topic in the toolbar.</p>
      <ul className={styles.plainList}>
        {paragraphs.map((item) => (
          <li key={`${item.journal_id}:${item.paragraph_id}`} className={styles.plainItem}>
            <Link to={paths.article(item.journal_id)} className={styles.itemTitle}>
              {item.journal?.title || `Article #${item.journal_id}`}
            </Link>
            <div className={styles.sub}>{paragraphText(item.journal?.content, item.paragraph_id) || item.paragraph_id}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Podcast guests on the schedule with this topic (set on each schedule entry). Read-only here. */
const PodcastGuestsTab = ({ topic }: { topic: JournalTopic }) => {
  const podcasts = Array.isArray(topic.podcasts) ? topic.podcasts : [];
  if (!podcasts.length) return <Empty description="No podcast guest has this topic" />;
  return (
    <div className={styles.tab}>
      <p className={styles.hint}>Set on the Podcast Schedule: each guest's topics are on its own form.</p>
      <ul className={styles.plainList}>
        {podcasts.map((podcast) => (
          <li key={podcast.id} className={styles.plainItem}>
            <Link to={paths.podcastScheduleItem(podcast.id)} className={styles.itemTitle}>
              {podcast.name || `Guest #${podcast.id}`}
            </Link>
            <div className={styles.sub}>
              {[shortDate(podcast.schedule_date), podcast.short_description].filter(Boolean).join(" · ")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * One topic's screen (route /topics/:id, `?tab=` a kind): everything its page on the website shows, by kind. Admins put
 * articles, videos, professionals, brands and products on it by hand or with the AI, then edit freely (Nov 24, the
 * backend's handoff 8.17). Paragraph tags and podcast guests are set elsewhere and listed here.
 */
const TopicScreen = () => {
  const id = useIdParam();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [topic, setTopic] = useState<JournalTopic | null>(null);
  const [problem, setProblem] = useState<"not_found" | "failed" | null>(() => (/^\d+$/.test(id) ? null : "not_found"));
  const [answer, setAnswer] = useState<TopicItems | null>(null);
  // The API answered no items route (it predates Nov 24), or failed.
  const [itemsProblem, setItemsProblem] = useState<"unavailable" | "failed" | null>(null);
  const [paragraphs, setParagraphs] = useState<TopicParagraph[] | null>(null);
  const [itemReloads, setItemReloads] = useState(0);
  const topicId = Number(id);

  const reloadItems = useCallback(() => setItemReloads((n) => n + 1), []);

  useEffect(() => {
    if (!/^\d+$/.test(id)) return;
    let current = true;
    GetJournalTopicById(id)
      .then((res) => {
        if (!current) return;
        const found = res.data.data;
        // A missing topic may answer a sentence rather than 404.
        if (found && typeof found === "object" && "id" in found) setTopic(found);
        else setProblem("not_found");
      })
      .catch((err) => {
        if (!current) return;
        console.error("Error loading the topic:", err);
        setProblem(apiErrorStatus(err) === 404 ? "not_found" : "failed");
      });
    GetJournalTopicParagraphs(id)
      .then((res) => {
        if (current) setParagraphs(Array.isArray(res.data.data) ? res.data.data : []);
      })
      .catch((err) => {
        console.error("Error loading the topic's paragraphs:", err);
        if (current) setParagraphs([]);
      });
    return () => {
      current = false;
    };
  }, [id]);

  useEffect(() => {
    if (!/^\d+$/.test(id)) return;
    let current = true;
    GetTopicItems(id)
      .then((res) => {
        if (!current) return;
        setAnswer(res.data.data);
        setItemsProblem(null);
      })
      .catch((err) => {
        if (!current) return;
        console.error("Error loading the topic's items:", err);
        if (apiErrorStatus(err) === 404) setItemsProblem("unavailable");
        else {
          setItemsProblem("failed");
          message.error(apiErrorMessage(err) || "Couldn't load what is on the topic");
        }
      });
    return () => {
      current = false;
    };
  }, [id, itemReloads]);

  if (problem || !topic) {
    return (
      <div>
        <PageHeader title="Topic" back={paths.topics} />
        <Panel>
          {problem === "not_found" ? (
            <Empty description="No such topic: it may have been deleted." />
          ) : problem === "failed" ? (
            <Empty description="The topic couldn't be loaded. Try again in a moment." />
          ) : (
            <div className={styles.loading}>
              <Spin />
            </div>
          )}
        </Panel>
      </div>
    );
  }

  const unavailable = itemsProblem === "unavailable";
  const wanted = params.get("tab") ?? KINDS[0].type;
  // Without the items (an API from before Nov 24), only the read-only tabs remain.
  const tab = unavailable && KINDS.some((kind) => kind.type === wanted) ? "paragraphs" : wanted;
  const items = answer?.items;
  const suggestions = answer?.suggestions;

  const kindTabs = KINDS.map((kind) => ({
    key: kind.type,
    label: (
      <span>
        {kind.many} ({items?.[kind.type]?.length ?? 0})
        {(suggestions?.[kind.type]?.length ?? 0) > 0 && (
          <Badge count={suggestions![kind.type].length} size="small" className={styles.tabBadge} title="Suggested by the AI" />
        )}
      </span>
    ),
    children: answer ? (
      <TopicItemsTab
        topicId={topicId}
        type={kind.type}
        items={answer.items[kind.type] ?? []}
        suggestions={answer.suggestions[kind.type] ?? []}
        onChange={setAnswer}
        onReload={reloadItems}
      />
    ) : itemsProblem ? (
      <Empty description="Couldn't load what is on the topic." />
    ) : (
      <Spin />
    ),
  }));

  return (
    <div>
      <PageHeader
        title={topic.name}
        subtitle="Everything this topic's page shows. Put items on it by hand or with the AI, then edit freely."
        back={paths.topics}
        extra={
          <>
            <Button icon={<ExportOutlined />} href={websiteUrl(`/topics/${topic.slug || topic.id}`)} target="_blank" rel="noopener noreferrer">
              View on site
            </Button>
            <Button icon={<EditOutlined />} onClick={() => navigate(paths.editTopic(topic.id))}>
              Edit topic
            </Button>
          </>
        }
      />

      {topic.is_featured && (
        <Alert
          type="info"
          showIcon
          className={styles.block}
          title="On the home page"
          description="This topic is a tile in the home page's Explore row, so what goes on it shows to many visitors: prefer Suggest first when running the AI."
        />
      )}

      {unavailable ? (
        <Alert
          type="warning"
          showIcon
          className={styles.block}
          title="The API doesn't have topic items yet"
          description="This screen needs the backend's Nov 24 update (topics by hand or by AI). Deploy its master and run npm run migrate, then reload."
        />
      ) : (
        <Panel>
          <AiPanel topicId={topicId} onFinished={reloadItems} />
        </Panel>
      )}

      <Panel>
        <Tabs
          activeKey={tab}
          onChange={(key) => setParams({ tab: key }, { replace: true })}
          items={[
            ...(unavailable ? [] : kindTabs),
            {
              key: "paragraphs",
              label: `Paragraph tags (${paragraphs?.length ?? 0})`,
              children: <ParagraphsTab paragraphs={paragraphs} />,
            },
            {
              key: "podcast",
              label: `Podcast guests (${topic.podcasts?.length ?? 0})`,
              children: <PodcastGuestsTab topic={topic} />,
            },
          ]}
        />
      </Panel>
    </div>
  );
};

export default TopicScreen;
