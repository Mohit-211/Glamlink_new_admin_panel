import React, { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tooltip,
  message,
  type FormInstance,
  type TableColumnsType,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import PageHeader, { Panel } from "../../../../components/PageHeader";
import {
  CreateProductTag,
  DeleteProductTag,
  GetProductTags,
  OrderProductTags,
  UpdateProductTag,
} from "../../../../services/Api/ProductTagsApi";
import { apiErrorCode, apiErrorMessage, apiErrorStatus } from "../../../../utils/apiError";
import { showFieldError } from "../../../../utils/formErrors";
import { ORDER_WORDS, moveItem, plural, useOrderSaver } from "../../../ProfilePages/pageContent";
import type { ProductTag } from "../../../../types/productTag";
import styles from "./ProductTags.module.scss";

/** The API's limit on a tag's name. */
const NAME_MAX = 40;

interface TagValues {
  name: string;
  /** Asked for a new tag only; the list's switch changes it after. */
  is_editorial?: boolean;
}

/**
 * Puts a refused name on the name field: 409 TAG_EXISTS (another tag has it, ignoring case) or 400 INVALID_TAG with
 * `details.field`. Returns the API's message for the caller to show too; null when the refusal is about no field.
 */
const showNameError = (form: FormInstance<TagValues>, err: unknown): string | null => {
  const shown = showFieldError(form, err);
  if (shown || apiErrorCode(err) !== "TAG_EXISTS") return shown;
  const text = apiErrorMessage(err) || "Another tag has this name.";
  form.setFields([{ name: "name", errors: [text] }]);
  return text;
};

interface TagModalProps {
  open: boolean;
  /** null to add one. */
  tag: ProductTag | null;
  onClose: () => void;
  onSaved: () => void;
  /** The tag was deleted meanwhile: the list reloads. */
  onGone: () => void;
}

/** Adds a tag, or renames one. Mounted afresh for each opening, so its form starts from that tag. */
const TagModal = ({ open, tag, onClose, onSaved, onGone }: TagModalProps) => {
  const [form] = Form.useForm<TagValues>();
  const [saving, setSaving] = useState(false);

  const save = async (values: TagValues) => {
    const name = values.name.trim();
    try {
      setSaving(true);
      if (tag) await UpdateProductTag(tag.id, { name });
      else await CreateProductTag({ name, is_editorial: Boolean(values.is_editorial) });
      message.success(tag ? `Renamed to “${name}”` : `“${name}” is added`);
      onSaved();
    } catch (err) {
      message.error(showNameError(form, err) || apiErrorMessage(err) || "Couldn't save the tag");
      if (apiErrorStatus(err) === 404) onGone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={tag ? `Rename “${tag.name}”` : "Add a tag"}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={tag ? "Rename" : "Add tag"}
      confirmLoading={saving}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={tag ? { name: tag.name } : { name: "", is_editorial: false }}
        onFinish={save}
      >
        <Form.Item
          name="name"
          label="Name"
          rules={[
            { required: true, whitespace: true, message: "Give the tag a name" },
            { max: NAME_MAX, message: `At most ${NAME_MAX} characters` },
          ]}
        >
          <Input maxLength={NAME_MAX} showCount placeholder="e.g. Best Seller" />
        </Form.Item>
        {!tag && (
          <Form.Item
            name="is_editorial"
            label="Editorial"
            valuePropName="checked"
            extra="Only admins can set an editorial tag. Owners can set an open one on their own products."
          >
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

/**
 * The products' tags (Nov 4): one per product, shown top-left on its card and its page, and offered in this order on
 * the product forms. Admins add, rename, reorder and delete them, and say which are editorial.
 */
const ProductTags = () => {
  const [tags, setTags] = useState<ProductTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  // The tag whose switch is saving.
  const [switching, setSwitching] = useState<number | null>(null);
  // `opening` counts openings: each one mounts a new dialog, which still closes with its animation.
  const [modal, setModal] = useState<{ open: boolean; tag: ProductTag | null; opening: number }>({
    open: false,
    tag: null,
    opening: 0,
  });
  const [dropAt, setDropAt] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    GetProductTags()
      .then((res) => {
        if (!current) return;
        setTags(Array.isArray(res.data.data) ? res.data.data : []);
        setLoadError(null);
      })
      .catch((err) => {
        console.error("Error loading the product tags:", err);
        if (current) setLoadError(apiErrorMessage(err) || "Couldn't load the tags");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [reloads]);

  const saveOrder = useCallback((ids: number[]) => OrderProductTags(ids), []);
  const orderFailed = useCallback(
    (err: unknown) => {
      message.error(apiErrorMessage(err) || "Couldn't save the new order");
      // Back to the order the API kept.
      reload();
    },
    [reload],
  );
  const order = useOrderSaver(saveOrder, orderFailed);

  const move = (from: number, to: number) => {
    const next = moveItem(tags, from, to);
    if (next === tags) return;
    setTags(next);
    order.schedule(next.map((tag) => tag.id));
  };

  const openModal = (tag: ProductTag | null) => setModal((m) => ({ open: true, tag, opening: m.opening + 1 }));
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  const setEditorial = async (tag: ProductTag, isEditorial: boolean) => {
    setSwitching(tag.id);
    try {
      const res = await UpdateProductTag(tag.id, { is_editorial: isEditorial });
      // The API answers the tag as it is now.
      const saved = res.data.data ?? { ...tag, is_editorial: isEditorial };
      setTags((list) => list.map((row) => (row.id === tag.id ? saved : row)));
      message.success(
        isEditorial ? `“${tag.name}” is editorial: only admins can set it` : `“${tag.name}” is open: owners can set it too`,
      );
    } catch (err) {
      message.error(apiErrorMessage(err) || "Couldn't change the tag");
      if (apiErrorStatus(err) === 404) reload();
    } finally {
      setSwitching(null);
    }
  };

  const remove = async (tag: ProductTag) => {
    try {
      const res = await DeleteProductTag(tag.id);
      const untagged = Number(res.data.data?.products_untagged) || 0;
      setTags((list) => list.filter((row) => row.id !== tag.id));
      message.success(
        untagged
          ? `“${tag.name}” is deleted; ${plural(untagged, "product")} lost it`
          : `“${tag.name}” is deleted; no product had it`,
      );
    } catch (err) {
      message.error(apiErrorMessage(err) || "Couldn't delete the tag");
      if (apiErrorStatus(err) === 404) reload();
    }
  };

  const rowDrag = (index: number): React.HTMLAttributes<HTMLTableRowElement> => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLTableRowElement>) => {
      dragFrom.current = index;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(tags[index]?.id ?? ""));
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
  });

  const columns: TableColumnsType<ProductTag> = [
    {
      key: "drag",
      width: 44,
      render: () => <HolderOutlined className={styles.dragHandle} aria-hidden />,
    },
    {
      title: "Tag",
      dataIndex: "name",
      render: (name: string) => <span className={styles.name}>{name}</span>,
    },
    {
      title: "Editorial",
      dataIndex: "is_editorial",
      width: 110,
      render: (isEditorial: boolean, tag) => (
        <Switch
          checked={isEditorial}
          loading={switching === tag.id}
          aria-label={`“${tag.name}” is editorial`}
          onChange={(checked) => setEditorial(tag, checked)}
        />
      ),
    },
    {
      key: "actions",
      align: "right",
      render: (_, tag, index) => {
        const name = `“${tag.name}”`;
        return (
          <div className={styles.actions}>
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
                  disabled={index >= tags.length - 1}
                  onClick={() => move(index, index + 1)}
                />
              </Tooltip>
            </Space.Compact>
            <Button size="small" icon={<EditOutlined />} aria-label={`Rename ${name}`} onClick={() => openModal(tag)}>
              Rename
            </Button>
            <Popconfirm
              title={`Delete ${name}?`}
              description="The products that carry it lose the tag; the products themselves stay."
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Keep it"
              onConfirm={() => remove(tag)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Delete ${name}`} />
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Product tags"
        subtitle="One tag per product, shown top-left on its card and its page. Editorial: only admins can set it, so owners can't claim a feature they didn't get."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
            Add a tag
          </Button>
        }
      />
      <Panel>
        {loadError ? (
          <Alert
            type="error"
            showIcon
            title={loadError}
            action={
              <Button size="small" onClick={reload}>
                Try again
              </Button>
            }
          />
        ) : (
          <>
            {tags.length > 0 && (
              <div className={styles.summary}>
                <span>
                  {plural(tags.length, "tag")}, in the order the product forms offer them. Drag to reorder, or use the
                  arrows.
                </span>
                {order.status !== "idle" && (
                  <span className={styles.muted} role="status">
                    {ORDER_WORDS[order.status]}
                  </span>
                )}
              </div>
            )}
            <Table<ProductTag>
              columns={columns}
              dataSource={tags}
              rowKey="id"
              loading={loading}
              size="middle"
              pagination={false}
              locale={{ emptyText: "No tags yet. Add one, and the product forms offer it." }}
              onRow={(tag, index) => ({ ...rowDrag(index ?? 0), "aria-label": tag.name })}
              rowClassName={(_, index) => (dropAt === index ? `${styles.row} ${styles.dropTarget}` : styles.row)}
            />
          </>
        )}
      </Panel>
      {modal.opening > 0 && (
        <TagModal
          key={modal.opening}
          open={modal.open}
          tag={modal.tag}
          onClose={closeModal}
          onSaved={() => {
            closeModal();
            reload();
          }}
          onGone={() => {
            closeModal();
            reload();
          }}
        />
      )}
    </div>
  );
};

export default ProductTags;
