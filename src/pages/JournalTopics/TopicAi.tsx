import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Segmented,
  Spin,
  Table,
  Tag,
  Tooltip,
  message,
  type TableColumnsType,
} from "antd";
import { RobotOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { GetTopicAiRun, GetTopicAiRuns, StartTopicAiRun } from "../../services/Api/TopicsApi";
import { apiErrorBody, apiErrorCode, apiErrorMessage } from "../../utils/apiError";
import type { TopicAiMode, TopicAiPick, TopicAiRun, TopicItemType } from "../../types/topic";
import { plural } from "../ProfilePages/pageContent";
import { KIND, KINDS, MIN_SCORE, OUTCOME, itemPath } from "./topicItems";
import styles from "./TopicScreen.module.scss";

/** How often a running run is read again (tests shorten it). */
export const POLL = { ms: 2500 };
/** Reads in a row that may fail (a network blip) before the screen stops following the run. */
const MAX_FAILED_READS = 5;
/** The runs listed under the button. */
const HISTORY = 5;

const MODE_LABEL: Record<TopicAiMode, string> = { suggest: "Suggest first", apply: "Attach now" };

const kindsOf = (types: TopicItemType[]) => types.map((type) => KIND[type].many).join(", ");
const when = (date: string | null) => (date ? dayjs(date).format("MMM D, h:mm A") : "");

interface RunValues {
  types: TopicItemType[];
  mode: TopicAiMode;
  instructions: string;
  limits: Record<TopicItemType, number>;
  min_score: number;
}

const INITIAL: RunValues = {
  types: KINDS.map((kind) => kind.type),
  // Topics have no draft: picks attached at once show on the website straight away, so suggestions come first.
  mode: "suggest",
  instructions: "",
  limits: Object.fromEntries(KINDS.map((kind) => [kind.type, kind.limit])) as Record<TopicItemType, number>,
  min_score: MIN_SCORE,
};

/** "Run AI": what to look for and what to do with the picks. Mounted only while open. */
const RunAiModal = ({
  topicId,
  onClose,
  onStarted,
}: {
  topicId: number;
  onClose: () => void;
  /** The run started, or the one already working on the topic. */
  onStarted: (runId: number) => void;
}) => {
  const [form] = Form.useForm<RunValues>();
  const [starting, setStarting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const types = Form.useWatch("types", form) ?? INITIAL.types;

  const start = async () => {
    const values = await form.validateFields();
    setStarting(true);
    setRefusal(null);
    try {
      const run = (
        await StartTopicAiRun(topicId, {
          types: values.types,
          mode: values.mode,
          instructions: values.instructions.trim() || undefined,
          limits: Object.fromEntries(values.types.map((type) => [type, values.limits[type]])),
          min_score: values.min_score,
        })
      ).data.data;
      onStarted(run.id);
    } catch (err) {
      const code = apiErrorCode(err);
      const runningId = Number(apiErrorBody(err)?.details?.run_id);
      if (code === "AI_RUN_IN_PROGRESS" && runningId) {
        message.info("This topic has a run working already: following that one.");
        onStarted(runningId);
      } else if (code === "AI_NOT_CONFIGURED") {
        setRefusal("The AI isn't set up on the server: the API needs OPENAI_API_KEY in its .env.");
      } else {
        setRefusal(apiErrorMessage(err) || "Couldn't start the AI");
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal
      open
      title="Run the AI on this topic"
      okText="Run AI"
      onOk={start}
      confirmLoading={starting}
      onCancel={onClose}
      width={640}
      destroyOnHidden
    >
      <p className={styles.hint}>
        The AI reads what the website shows (published articles, videos and products, and the professional and brand
        pages that show) and picks what fits this topic, each with a score and a reason. It never picks what the topic
        has, or what was taken off it, so running it again only looks for more. A run takes a few seconds to a minute or
        two.
      </p>
      {refusal && <Alert type="error" showIcon title={refusal} className={styles.modalAlert} />}
      <Form<RunValues> form={form} layout="vertical" initialValues={INITIAL} requiredMark={false}>
        <Form.Item
          name="types"
          label="Look for"
          rules={[{ required: true, type: "array", min: 1, message: "Pick at least one kind" }]}
        >
          <Checkbox.Group options={KINDS.map((kind) => ({ value: kind.type, label: kind.many }))} />
        </Form.Item>
        <Form.Item name="mode" label="Then">
          <Radio.Group className={styles.modes}>
            <Radio value="suggest">
              <strong>Suggest first</strong>
              <div className={styles.modeHint}>The picks wait under "Suggested by the AI" on each tab: add or dismiss each one.</div>
            </Radio>
            <Radio value="apply">
              <strong>Attach now</strong>
              <div className={styles.modeHint}>
                The picks go on the topic at once. Topics have no draft: if the website lists this topic, they show there
                straight away.
              </div>
            </Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="instructions" label="Notes for the AI" extra="Optional, like: Focus on at-home routines.">
          <Input.TextArea maxLength={1000} showCount autoSize={{ minRows: 2, maxRows: 5 }} />
        </Form.Item>
        <div className={styles.limits}>
          {KINDS.filter((kind) => types.includes(kind.type)).map((kind) => (
            <Form.Item key={kind.type} name={["limits", kind.type]} label={`Most new ${kind.many.toLowerCase()}`}>
              <InputNumber min={1} max={30} precision={0} />
            </Form.Item>
          ))}
          <Form.Item
            name="min_score"
            label="Lowest score"
            tooltip="Picks the AI scores under this (0 to 100) aren't used. 80 or more: clearly about the topic; 60 to 79: relevant."
          >
            <InputNumber min={0} max={100} precision={0} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

const RUN_STATUS: Record<TopicAiRun["status"], { label: string; color?: string }> = {
  running: { label: "Working", color: "processing" },
  done: { label: "Done", color: "green" },
  failed: { label: "Failed", color: "red" },
};

type PickView = "used" | "left" | "all";
const USED = new Set(["added", "suggested", "already_on"]);

/** A run's report: what it was asked, what it read and did, and every pick with its reason. */
export const RunReport = ({ run }: { run: TopicAiRun }) => {
  const picks = run.picks ?? [];
  const used = picks.filter((pick) => USED.has(pick.outcome));
  const [view, setView] = useState<PickView>("used");

  const columns: TableColumnsType<TopicAiPick> = [
    { title: "Kind", dataIndex: "type", width: 120, render: (type: TopicItemType) => KIND[type]?.many.replace(/s$/, "") ?? type },
    {
      title: "Item",
      key: "item",
      render: (_, pick) => <Link to={itemPath(pick)}>{pick.title || `${KIND[pick.type]?.one ?? pick.type} #${pick.id}`}</Link>,
    },
    { title: "Score", dataIndex: "score", width: 80 },
    { title: "Why", dataIndex: "reason", render: (reason: string | null) => reason ?? "" },
    {
      title: "Outcome",
      dataIndex: "outcome",
      width: 140,
      render: (outcome: TopicAiPick["outcome"]) => {
        const known = OUTCOME[outcome];
        return known ? (
          <Tooltip title={known.hint}>
            <Tag color={known.color}>{known.label}</Tag>
          </Tooltip>
        ) : (
          <Tag>{outcome}</Tag>
        );
      },
    },
  ];

  const shown = view === "used" ? used : view === "left" ? picks.filter((pick) => !USED.has(pick.outcome)) : picks;
  const summary =
    run.status === "running"
      ? "Reading the site…"
      : `Read ${plural(run.considered, "item")}: ${run.added} added, ${run.suggested} suggested.`;

  return (
    <div className={styles.report}>
      <div className={styles.reportHead}>
        <Tag color={RUN_STATUS[run.status].color}>{RUN_STATUS[run.status].label}</Tag>
        <span>
          {MODE_LABEL[run.mode]} · {kindsOf(run.types)} · started {when(run.started_at)}
        </span>
      </div>
      <p className={styles.reportSummary}>{summary}</p>
      {run.instructions && <p className={styles.muted}>Notes: {run.instructions}</p>}
      {run.error && (
        <Alert
          type={run.status === "failed" ? "error" : "warning"}
          showIcon
          title={run.status === "failed" ? "The run failed" : "Some kinds failed"}
          description={run.error}
          className={styles.modalAlert}
        />
      )}
      {picks.length > 0 && (
        <>
          <Segmented<PickView>
            value={view}
            onChange={setView}
            options={[
              { value: "used", label: `Used (${used.length})` },
              { value: "left", label: `Left out (${picks.length - used.length})` },
              { value: "all", label: `All picks (${picks.length})` },
            ]}
            className={styles.reportFilter}
          />
          <Table<TopicAiPick>
            rowKey={(pick) => `${pick.type}:${pick.id}`}
            columns={columns}
            dataSource={shown}
            size="small"
            pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: 720 }}
            locale={{ emptyText: "None" }}
          />
        </>
      )}
      {run.status !== "running" && (
        <p className={styles.tokens}>
          {run.model ? `${run.model}: ` : ""}
          {run.input_tokens.toLocaleString("en-US")} tokens in, {run.output_tokens.toLocaleString("en-US")} out
        </p>
      )}
    </div>
  );
};

/**
 * The topic's AI: "Run AI", the run being followed (read every few seconds until it's done) with its report, and the
 * latest runs. `onFinished` reloads the topic's items once a run ends.
 */
export const AiPanel = ({ topicId, onFinished }: { topicId: number; onFinished: () => void }) => {
  const [runs, setRuns] = useState<TopicAiRun[] | null>(null);
  // The run followed now, or the last one that ended here, with its picks.
  const [current, setCurrent] = useState<TopicAiRun | null>(null);
  const [following, setFollowing] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [opened, setOpened] = useState<TopicAiRun | null>(null);
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  const loadRuns = useCallback(async () => {
    try {
      const rows = (await GetTopicAiRuns(topicId, { limit: HISTORY })).data.data.rows;
      setRuns(rows);
      return rows;
    } catch (err) {
      console.error("Couldn't load the AI runs:", err);
      setRuns([]);
      return [];
    }
  }, [topicId]);

  // On opening: the latest runs; a run still working is followed.
  useEffect(() => {
    let active = true;
    loadRuns().then((rows) => {
      const running = rows.find((run) => run.status === "running");
      if (active && running) setFollowing(running.id);
    });
    return () => {
      active = false;
    };
  }, [loadRuns]);

  // Following a run: read it until it is no longer running.
  useEffect(() => {
    if (following === null) return;
    let active = true;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      try {
        const run = (await GetTopicAiRun(topicId, following)).data.data;
        if (!active) return;
        failures = 0;
        setCurrent(run);
        if (run.status === "running") {
          timer = setTimeout(read, POLL.ms);
          return;
        }
        setFollowing(null);
        loadRuns();
        finished.current();
        if (run.status === "failed") message.error("The AI run failed: see its report");
        else message.success(`AI run done: ${run.added} added, ${run.suggested} suggested`);
      } catch (err) {
        if (!active) return;
        if (++failures >= MAX_FAILED_READS) {
          console.error("Lost track of the AI run:", err);
          setFollowing(null);
          message.error("Lost track of the AI run: reload the page to see how it ended.");
          return;
        }
        timer = setTimeout(read, POLL.ms);
      }
    };
    read();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [following, topicId, loadRuns]);

  const open = async (run: TopicAiRun) => {
    try {
      setOpened((await GetTopicAiRun(topicId, run.id)).data.data);
    } catch (err) {
      message.error(apiErrorMessage(err) || "Couldn't open the run");
    }
  };

  const historyColumns: TableColumnsType<TopicAiRun> = [
    { title: "Started", dataIndex: "started_at", width: 150, render: when },
    { title: "Mode", dataIndex: "mode", width: 120, render: (mode: TopicAiMode) => MODE_LABEL[mode] },
    { title: "Looked for", dataIndex: "types", render: kindsOf },
    { title: "Added", dataIndex: "added", width: 80 },
    { title: "Suggested", dataIndex: "suggested", width: 100 },
    {
      title: "",
      key: "status",
      width: 170,
      render: (_, run) => (
        <span className={styles.runActions}>
          <Tag color={RUN_STATUS[run.status].color}>{RUN_STATUS[run.status].label}</Tag>
          {run.status !== "running" && (
            <Button size="small" type="link" onClick={() => open(run)}>
              Report
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.ai}>
      <div className={styles.aiHead}>
        <div>
          <h4 className={styles.blockTitle}>
            <RobotOutlined /> AI
          </h4>
          <p className={styles.hint}>
            Let the AI read the site and pick what fits this topic, then edit freely: what you take off, it won't bring
            back.
          </p>
        </div>
        <Button type="primary" icon={<RobotOutlined />} onClick={() => setAsking(true)} disabled={following !== null}>
          Run AI
        </Button>
      </div>

      {following !== null && (
        <div className={styles.working}>
          <Spin size="small" />
          <span>
            The AI is reading the site for this topic
            {current?.status === "running" && current.started_at ? ` (started ${when(current.started_at)})` : ""}. This page
            updates when it's done.
          </span>
        </div>
      )}
      {current && current.status !== "running" && following === null && <RunReport run={current} />}

      {runs && runs.length > 0 && (
        <Table<TopicAiRun>
          rowKey="id"
          columns={historyColumns}
          dataSource={runs}
          size="small"
          pagination={false}
          scroll={{ x: 700 }}
          className={styles.history}
        />
      )}

      {asking && (
        <RunAiModal
          topicId={topicId}
          onClose={() => setAsking(false)}
          onStarted={(runId) => {
            setAsking(false);
            setCurrent(null);
            setFollowing(runId);
          }}
        />
      )}
      <Modal open={opened !== null} title="AI run" footer={null} width={900} onCancel={() => setOpened(null)} destroyOnHidden>
        {opened && <RunReport run={opened} />}
      </Modal>
    </div>
  );
};
