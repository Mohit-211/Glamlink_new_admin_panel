import React, { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router";
import { Avatar, Button, Popconfirm, Space, Table, Tag, Tooltip, message, type TableColumnsType } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  DeleteOutlined,
  HolderOutlined,
  PictureOutlined,
  PlusOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { AddTopicItems, OrderTopicItems, RemoveTopicItem } from "../../services/Api/TopicsApi";
import { apiErrorMessage } from "../../utils/apiError";
import type { TopicItem, TopicItemType, TopicItems } from "../../types/topic";
import { ORDER_WORDS, moveItem, plural, useOrderSaver } from "../ProfilePages/pageContent";
import TopicItemPicker from "./TopicItemPicker";
import { KIND, STATUS, itemDetail, itemPath } from "./topicItems";
import styles from "./TopicScreen.module.scss";

interface TopicItemsTabProps {
  topicId: number;
  type: TopicItemType;
  items: TopicItem[];
  suggestions: TopicItem[];
  /** Every change answers the topic's whole list. */
  onChange: (answer: TopicItems) => void;
  /** Back to what the API has, after a change it refused. */
  onReload: () => void;
}

/** The AI's score and reason, as a badge. */
export const AiBadge = ({ item }: { item: TopicItem }) => {
  if (!item.ai) return null;
  const title = (
    <>
      <div>AI score {item.ai.score} of 100</div>
      {item.ai.reason && <div>{item.ai.reason}</div>}
    </>
  );
  return (
    <Tooltip title={title}>
      <Tag color="purple" icon={<RobotOutlined />} className={styles.aiTag}>
        AI {item.ai.score}
      </Tag>
    </Tooltip>
  );
};

/** An item's picture, title (opening it in the panel) and what tells it apart. */
const ItemCell = ({ item }: { item: TopicItem }) => {
  const detail = itemDetail(item);
  return (
    <div className={styles.itemCell}>
      <Avatar shape="square" size={40} src={item.image || undefined} icon={<PictureOutlined />} alt="" className={styles.thumb} />
      <div className={styles.itemText}>
        <Link to={itemPath(item)} className={styles.itemTitle}>
          {item.title || `${KIND[item.type].one} #${item.id}`}
        </Link>
        {detail && <div className={styles.sub}>{detail}</div>}
      </div>
    </div>
  );
};

const StatusTag = ({ status }: { status: string | null }) => {
  const known = status ? STATUS[status] : undefined;
  if (!known) return status ? <Tag>{status}</Tag> : null;
  const tag = <Tag color={known.color}>{known.label}</Tag>;
  return known.hint ? <Tooltip title={known.hint}>{tag}</Tooltip> : tag;
};

/**
 * One kind of item on a topic: the AI's suggestions to take or dismiss, a picker to add more by hand, and what is on
 * the topic, each removable (the AI won't put it back) and, for professionals, brands and products, in the topic's
 * order (drag, or the arrows).
 */
const TopicItemsTab = ({ topicId, type, items, suggestions, onChange, onReload }: TopicItemsTabProps) => {
  const kind = KIND[type];
  const [rows, setRows] = useState(items);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  // The list the API answered last; a reorder changes `rows` first, then saves.
  useEffect(() => setRows(items), [items]);

  const saveOrder = useCallback((ids: number[]) => OrderTopicItems(topicId, type, ids), [topicId, type]);
  const orderFailed = useCallback(
    (err: unknown) => {
      message.error(apiErrorMessage(err) || "Couldn't save the new order");
      onReload();
    },
    [onReload],
  );
  const order = useOrderSaver(saveOrder, orderFailed);

  const move = (from: number, to: number) => {
    const next = moveItem(rows, from, to);
    if (next === rows) return;
    setRows(next);
    order.schedule(next.map((item) => item.id));
  };

  /** Runs a change; its answer is the topic's new list. */
  const change = async (key: string, call: () => Promise<{ data: { data: TopicItems } }>, done: string, failed: string) => {
    setBusy(key);
    try {
      onChange((await call()).data.data);
      message.success(done);
      return true;
    } catch (err) {
      message.error(apiErrorMessage(err) || failed);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addPicked = async () => {
    const added = await change(
      "add",
      () => AddTopicItems(topicId, picked.map((id) => ({ type, id }))),
      `${plural(picked.length, kind.one)} added`,
      `Couldn't add the ${kind.many.toLowerCase()}`,
    );
    if (added) setPicked([]);
  };

  const take = (item: TopicItem) =>
    change(`take:${item.id}`, () => AddTopicItems(topicId, [{ type, id: item.id }]), "Added to the topic", "Couldn't add it");

  const dismiss = (item: TopicItem) =>
    change(`dismiss:${item.id}`, () => RemoveTopicItem(topicId, type, item.id), "Suggestion dismissed", "Couldn't dismiss it");

  const remove = (item: TopicItem) =>
    change(`remove:${item.id}`, () => RemoveTopicItem(topicId, type, item.id), "Taken off the topic", "Couldn't take it off");

  const rowDrag = (index: number): React.HTMLAttributes<HTMLTableRowElement> =>
    kind.ordered
      ? {
          draggable: true,
          onDragStart: (event: DragEvent<HTMLTableRowElement>) => {
            dragFrom.current = index;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(rows[index]?.id ?? ""));
          },
          onDragOver: (event: DragEvent<HTMLTableRowElement>) => {
            if (dragFrom.current === null) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            if (dropAt !== index) setDropAt(index);
          },
          onDrop: (event: DragEvent<HTMLTableRowElement>) => {
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
          className: dropAt === index ? styles.dropTarget : undefined,
        }
      : {};

  const columns: TableColumnsType<TopicItem> = [
    ...(kind.ordered
      ? [{ key: "drag", width: 40, render: () => <HolderOutlined className={styles.dragHandle} aria-hidden /> }]
      : []),
    { title: kind.many.replace(/s$/, ""), key: "item", render: (_, item) => <ItemCell item={item} /> },
    { title: "Status", key: "status", width: 110, render: (_, item) => <StatusTag status={item.status} /> },
    {
      title: "Added by",
      key: "source",
      width: 120,
      render: (_, item) => (item.source === "ai" ? <AiBadge item={item} /> : <span className={styles.muted}>An admin</span>),
    },
    {
      key: "actions",
      align: "right",
      width: kind.ordered ? 170 : 100,
      render: (_, item, index) => {
        const name = `“${item.title ?? kind.one}”`;
        return (
          <Space size={6}>
            {kind.ordered && (
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
                    disabled={index >= rows.length - 1}
                    onClick={() => move(index, index + 1)}
                  />
                </Tooltip>
              </Space.Compact>
            )}
            <Popconfirm
              title={`Take ${name} off this topic?`}
              description="It leaves the topic's page, and the AI won't add it again."
              okText="Take off"
              okButtonProps={{ danger: true }}
              cancelText="Keep it"
              onConfirm={() => remove(item)}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={`Take ${name} off`}
                loading={busy === `remove:${item.id}`}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className={styles.tab}>
      {suggestions.length > 0 && (
        <div className={styles.suggestions}>
          <h4 className={styles.blockTitle}>
            <RobotOutlined /> Suggested by the AI ({suggestions.length})
          </h4>
          <p className={styles.hint}>Not on the topic yet. Add the ones that fit; a dismissed one isn't suggested again.</p>
          <ul className={styles.suggestionList}>
            {suggestions.map((item) => (
              <li key={item.id} className={styles.suggestion}>
                <ItemCell item={item} />
                <div className={styles.suggestionWhy}>
                  <Tag color="purple">Score {item.ai?.score ?? "-"}</Tag>
                  <span>{item.ai?.reason ?? ""}</span>
                </div>
                <Space size={6}>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    loading={busy === `take:${item.id}`}
                    onClick={() => take(item)}
                  >
                    Add
                  </Button>
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    loading={busy === `dismiss:${item.id}`}
                    onClick={() => dismiss(item)}
                  >
                    Dismiss
                  </Button>
                </Space>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.addBar}>
        <div className={styles.addPicker}>
          <TopicItemPicker
            type={type}
            value={picked}
            onChange={setPicked}
            exclude={rows.map((item) => item.id)}
            disabled={busy === "add"}
          />
        </div>
        <Button type="primary" icon={<PlusOutlined />} disabled={!picked.length} loading={busy === "add"} onClick={addPicked}>
          Add
        </Button>
      </div>

      <div className={styles.listHead}>
        <span className={styles.muted}>
          {kind.ordered
            ? "In the topic page's order: drag a row, or use the arrows."
            : "Newest first, as the topic's page shows them."}
        </span>
        {kind.ordered && order.status !== "idle" && <span className={styles.muted}>{ORDER_WORDS[order.status]}</span>}
      </div>
      <Table<TopicItem>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        size="middle"
        pagination={false}
        onRow={(_, index) => rowDrag(index ?? 0)}
        scroll={{ x: 640 }}
        locale={{ emptyText: `No ${kind.many.toLowerCase()} on this topic yet` }}
      />
    </div>
  );
};

export default TopicItemsTab;
