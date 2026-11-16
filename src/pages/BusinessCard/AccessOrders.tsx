/** @format */

import React, { useEffect, useState } from "react";
import {
  Table,
  Modal,
  message,
  Select,
  Card,
  Tooltip,
  Button,
  Input,
  Alert,
  Popconfirm,
  Radio,
  Spin,
  Tag,
  Typography,
  type TableColumnsType,
} from "antd";
import {
  EyeOutlined,
  LinkOutlined,
  EnvironmentOutlined,
  SearchOutlined,
  PrinterOutlined,
  ExportOutlined,
  StopOutlined,
  CloseCircleOutlined,
  CreditCardOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router";
import "./AccessOrders.scss";
import {
  GetAllAccessOrders,
  GetAccessOrderById,
  UpdateAccessOrderFulfillment,
  accessOrderFromResponse,
  GetAccessOrderRates,
  BuyAccessOrderLabel,
  VoidAccessOrderLabel,
  CancelAccessOrder,
} from "../../services/Api/BusinessCardApi";
import { apiErrorCode, apiErrorMessage, apiErrorStatus } from "../../utils/apiError";
import { money } from "../../utils/money";
import type {
  AccessOrder,
  AccessOrderListParams,
  FulfillmentStatus,
  FulfillmentUpdate,
  ShippingOptionId,
} from "../../types/businessCard";
import type { ShippingRate } from "../../types/access";

const VEGAS_TZ = "America/Los_Angeles";

const formatVegasShort = (dateStr: string | null | undefined) => {
  if (!dateStr) return { date: "-", time: "" };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { date: "-", time: "" };
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: VEGAS_TZ,
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: VEGAS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return { date, time };
};

const formatVegasFull = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: VEGAS_TZ,
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d) + " PT"
  );
};

/**
 * Cancelled (Cancel order, CancelAccessOrder): the API sets `cancelled_at`. The payment status stays what the money
 * did ("paid": any refund is made by hand), and only an unshipped keychain's fulfillment reads "cancelled".
 */
const isCancelled = (order: AccessOrder | null | undefined) =>
  Boolean(order?.cancelled_at) || order?.payment_status === "cancelled" || order?.fulfillment_status === "cancelled";

/**
 * The order has a keychain to ship: Access Pro bought alone has no fulfillment status. A cancelled order's address
 * still says whether it had one.
 */
const isPhysical = (order: AccessOrder | null | undefined) =>
  order?.fulfillment_status === "cancelled"
    ? Boolean(order.shipping_address_line_1)
    : order?.fulfillment_status !== null && order?.fulfillment_status !== undefined;

const Pill = ({ text, type }: { text?: string; type?: string | null }) => (
  <span className={`ao-pill ao-pill-${type}`}>{text}</span>
);

/** A payment status as its pill says it ("partially_refunded" is "PARTLY REFUNDED"). */
const paymentWords = (status: string | null | undefined) =>
  status === "partially_refunded" ? "PARTLY REFUNDED" : status?.replaceAll("_", " ").toUpperCase();

/**
 * One order as its details answer it (GET /businessCard/access-orders/:id): since Nov 1 also what Stripe recorded
 * (a refund or a dispute made there, by the webhook) and the checkout that bought it.
 */
interface AccessOrderDetail extends AccessOrder {
  /** Dollars refunded so far, in Stripe's dashboard. */
  refunded_amount?: number | string | null;
  refunded_at?: string | null;
  /** Stripe's: needs_response, under_review, won, lost, warning_needs_response, … */
  dispute_status?: string | null;
  disputed_at?: string | null;
  checkout?: {
    id: number;
    /** free, nfc_only, subscription_only or nfc_with_subscription */
    plan_type: string | null;
    status: string | null;
    stripe_subscription_id: string | null;
    stripe_payment_intent_id: string | null;
    stripe_invoice_id: string | null;
  } | null;
}

const dollars = (amount: number | string | null | undefined) => `$${Number(amount || 0).toFixed(2)}`;

/** Stripe's dispute statuses, worded for people. */
const DISPUTE_WORDS: Partial<Record<string, string>> = {
  needs_response: "needs a response",
  warning_needs_response: "an inquiry that needs a response",
  under_review: "under review",
  warning_under_review: "an inquiry under review",
  won: "won",
  lost: "lost",
  warning_closed: "an inquiry, closed",
  prevented: "prevented",
};

/** A dispute that no longer holds the money: the payment reads as it did before. */
const DISPUTE_SETTLED = ["won", "warning_closed", "prevented"];

const PLAN_WORDS: Partial<Record<string, string>> = {
  subscription_only: "Access Pro",
  nfc_only: "NFC keychain",
  nfc_with_subscription: "Access Pro + NFC keychain",
  free: "Free",
};

/**
 * What happened to the money after the order, as Stripe told the API: a refund (in full or in part) and a dispute,
 * each made in Stripe's dashboard. Neither changes a plan, a seat or shipping. Also a purchase the API took but
 * couldn't give (its `cancel_reason` says so) while the order isn't cancelled.
 */
const MoneyEvents = ({ order }: { order: AccessOrderDetail }) => {
  const refunded = Number(order.refunded_amount || 0);
  const paid = Number(order.amount_paid || 0);
  const wasRefunded =
    refunded > 0 || Boolean(order.refunded_at) || order.payment_status === "refunded" || order.payment_status === "partially_refunded";
  const partly = order.payment_status === "partially_refunded" || (refunded > 0 && refunded < paid);
  const when = (date: string | null | undefined) => (date ? ` on ${formatVegasFull(date)}` : "");
  const disputed = Boolean(order.dispute_status || order.disputed_at) || order.payment_status === "disputed";
  const settled = Boolean(order.dispute_status && DISPUTE_SETTLED.includes(order.dispute_status));
  const disputeWords = order.dispute_status
    ? (DISPUTE_WORDS[order.dispute_status] ?? order.dispute_status.replaceAll("_", " "))
    : null;

  return (
    <>
      {wasRefunded && (
        <Alert
          className="ao-money-alert"
          type="warning"
          showIcon
          title={partly ? "Partly refunded" : "Refunded in full"}
          description={
            (partly
              ? `${dollars(refunded)} of ${dollars(paid)} was refunded in Stripe${when(order.refunded_at)}.`
              : `${dollars(refunded || paid)} was refunded in Stripe${when(order.refunded_at)}.`) +
            (isCancelled(order)
              ? ""
              : " A refund changes no plan, seat or shipping: cancel the order too if nothing more should happen.")
          }
        />
      )}
      {disputed && (
        <Alert
          className="ao-money-alert"
          type={settled ? "info" : "error"}
          showIcon
          title={settled ? "A dispute was settled" : order.dispute_status === "lost" ? "Dispute lost" : "Disputed"}
          description={[
            `The customer's bank disputed the payment${when(order.disputed_at)}.`,
            disputeWords ? `Stripe says: ${disputeWords}.` : "",
            settled
              ? "The payment stands."
              : order.dispute_status === "lost"
                ? "The money went back to the customer."
                : "Answer it in Stripe's dashboard before its deadline.",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      )}
      {order.cancel_reason && !isCancelled(order) && (
        <Alert className="ao-money-alert" type="warning" showIcon title="Paid but not given" description={order.cancel_reason} />
      )}
    </>
  );
};

/** What bought the order at Stripe, to find it in Stripe's dashboard (a refund or a dispute is handled there). */
const CheckoutSummary = ({ checkout }: { checkout: NonNullable<AccessOrderDetail["checkout"]> }) => {
  const stripeIds: [string, string | null][] = [
    ["Payment", checkout.stripe_payment_intent_id],
    ["Subscription", checkout.stripe_subscription_id],
    ["Invoice", checkout.stripe_invoice_id],
  ];
  return (
    <>
      <div className="ao-section-label">
        <CreditCardOutlined /> Checkout
      </div>
      <div className="ao-box">
        <div className="ao-info-grid ao-label-grid">
          <div className="ao-info-item">
            <div className="label">Plan</div>
            <div className="value">{(checkout.plan_type && PLAN_WORDS[checkout.plan_type]) || checkout.plan_type || "—"}</div>
          </div>
          <div className="ao-info-item">
            <div className="label">Checkout status</div>
            <div className="value">{checkout.status || "—"}</div>
          </div>
          {stripeIds
            .filter(([, id]) => id)
            .map(([label, id]) => (
              <div className="ao-info-item" key={label}>
                <div className="label">{label} in Stripe</div>
                <div className="value">
                  <Typography.Text copyable code className="ao-stripe-id">
                    {id}
                  </Typography.Text>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
};

const PAGE_SIZE = 50;

/** The statuses an admin sets by hand; "cancelled" comes only from cancelling the order. */
const FULFILLMENT_OPTIONS: { value: FulfillmentStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
];

const FULFILLMENT_FILTERS = [...FULFILLMENT_OPTIONS, { value: "cancelled" as const, label: "Cancelled" }];

/** "cancelled" is the API's `cancelled=true`, not a payment status (a cancelled order keeps what was paid). */
const PAYMENT_FILTERS = [
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partly refunded" },
  { value: "disputed", label: "Disputed" },
  { value: "cancelled", label: "Cancelled" },
];

/** What the list asks the API for: the page, the search and the two status filters. */
interface Filters {
  page: number;
  search: string;
  payment_status?: string;
  fulfillment_status?: FulfillmentStatus;
}

/** What Cancel order does, word for word in its confirmation. */
const CANCEL_EXPLANATION =
  "Marks the order cancelled, stops an unshipped keychain, and ends the Access Pro subscription bought with it right away. No refund is made: refund a keychain manually in Stripe if needed. Subscriptions are not refunded.";

// ---- Shipping labels (Shippo) ----

/** Shippo's tracking statuses, worded for people. */
const TRACKING: Partial<Record<string, { label: string; color?: string }>> = {
  PRE_TRANSIT: { label: "Awaiting pickup" },
  TRANSIT: { label: "In transit", color: "blue" },
  DELIVERED: { label: "Delivered", color: "green" },
  RETURNED: { label: "Returned", color: "orange" },
  FAILURE: { label: "Delivery problem", color: "red" },
  UNKNOWN: { label: "Unknown" },
};

const TrackingTag = ({ status }: { status?: string | null }) => {
  if (!status) return null;
  const known = TRACKING[status];
  return <Tag color={known?.color}>{known?.label ?? status}</Tag>;
};

/** Shippo's tags on a rate. */
const RATE_TAGS: Partial<Record<string, string>> = { CHEAPEST: "Cheapest", FASTEST: "Fastest", BESTVALUE: "Best value" };

/** Shippo's refund of a voided label. */
const REFUND_WORDS: Partial<Record<string, string>> = {
  QUEUED: "Shippo's refund is on its way",
  PENDING: "Shippo's refund is on its way",
  SUCCESS: "Shippo has refunded it",
  ERROR: "Shippo couldn't refund it; check Shippo's dashboard",
};

/** The order has a label (bought and not voided), or Shippo is still making one. */
const hasLabel = (order: AccessOrder) => Boolean(order.shippo_transaction_id);

/** Shippo took the purchase but hasn't made the label yet: no file and no tracking until it has. */
const labelPending = (order: AccessOrder) => hasLabel(order) && !order.label_url;

/** The shipping chosen at checkout, as the website named it. */
const OPTION_NAMES: Record<ShippingOptionId, string> = {
  standard: "Standard Shipping",
  expedited: "Expedited Shipping",
  flat: "Standard Shipping (flat price)",
  free: "Free shipping",
};

/** The parcel is moving (Shippo's tracking, or marked by hand): no voiding its label, no new one. */
const isOnItsWay = (order: AccessOrder) =>
  order.fulfillment_status === "shipped" || order.fulfillment_status === "delivered";

const carrierAndService = (order: AccessOrder) => [order.carrier, order.service].filter(Boolean).join(" ");

/** What "Buy label" buys when no rate is picked (the API's default). */
const defaultRateText = (order: AccessOrder) =>
  order.shippo_rate_id
    ? `the rate chosen at checkout${carrierAndService(order) ? ` (${carrierAndService(order)})` : ""} while Shippo still sells it (a week), else today's rate for the same service`
    : "today's standard rate: shipping was a flat price or free at checkout, so the customer didn't pick a service";

const rateDays = (rate: ShippingRate) =>
  rate.estimated_days
    ? `About ${rate.estimated_days} day${rate.estimated_days === 1 ? "" : "s"}`
    : rate.duration_terms || "";

interface LabelSectionProps {
  order: AccessOrder;
  onBuy: () => void;
  onVoid: () => Promise<void>;
  /** Asks again after a label Shippo was still making. */
  onCheck: () => Promise<void>;
}

/**
 * The order's label and tracking, with buying, printing and voiding the label. Only for orders that ship. A cancelled
 * order shows them for the record, with no buying or voiding: voiding here would put its fulfillment back to pending.
 */
const LabelSection = ({ order, onBuy, onVoid, onCheck }: LabelSectionProps) => {
  const labelBought = hasLabel(order);
  const moving = isOnItsWay(order);
  const cancelled = isCancelled(order);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      await onCheck();
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <div className="ao-section-label">
        <PrinterOutlined /> Shipping label
      </div>
      <div className="ao-box">
        <div className="ao-info-grid ao-label-grid">
          <div className="ao-info-item">
            <div className="label">Shipping chosen</div>
            <div className="value">{order.shipping_option ? OPTION_NAMES[order.shipping_option] : "—"}</div>
          </div>
          <div className="ao-info-item">
            <div className="label">{labelBought ? "Carrier" : "Carrier chosen at checkout"}</div>
            <div className="value">{order.carrier || "—"}</div>
          </div>
          <div className="ao-info-item">
            <div className="label">Service</div>
            <div className="value">{order.service || "—"}</div>
          </div>
          <div className="ao-info-item">
            <div className="label">Tracking number</div>
            <div className="value">
              {!order.tracking_number ? (
                "—"
              ) : order.tracking_link ? (
                <a href={order.tracking_link} target="_blank" rel="noopener noreferrer">
                  {order.tracking_number} <ExportOutlined />
                </a>
              ) : (
                order.tracking_number
              )}
            </div>
          </div>
          <div className="ao-info-item">
            <div className="label">Tracking</div>
            <div className="value">
              {order.tracking_status ? (
                <TrackingTag status={order.tracking_status} />
              ) : labelBought ? (
                "Not scanned yet"
              ) : (
                "—"
              )}
              {order.tracking_status_details && <div className="ao-label-note">{order.tracking_status_details}</div>}
            </div>
          </div>
          <div className="ao-info-item">
            <div className="label">Shipped</div>
            <div className="value">{formatVegasFull(order.shipped_at)}</div>
          </div>
          <div className="ao-info-item">
            <div className="label">Delivered</div>
            <div className="value">{formatVegasFull(order.delivered_at)}</div>
          </div>
        </div>

        {cancelled ? (
          labelBought &&
          !moving && (
            <div className="ao-label-note">
              The order is cancelled. If its label is unused, void it in Shippo's dashboard for a refund.
            </div>
          )
        ) : labelPending(order) ? (
          <div className="ao-label-actions">
            <Button type="primary" icon={<PrinterOutlined />} loading={checking} onClick={check}>
              Check again
            </Button>
            <span className="ao-label-note">
              Shippo is still making this label: its file and tracking come when it's done, usually within a minute.
            </span>
          </div>
        ) : labelBought ? (
          <div className="ao-label-actions">
            {order.label_url && (
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                href={order.label_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Print label
              </Button>
            )}
            {moving ? (
              <Tooltip title="The parcel is on its way, so its label can't be voided.">
                <Button danger icon={<StopOutlined />} disabled>
                  Void label
                </Button>
              </Tooltip>
            ) : (
              <Popconfirm
                title="Void this label?"
                description="Shippo refunds an unused label. The order goes back to pending, and you can buy a new one."
                okText="Void label"
                okButtonProps={{ danger: true }}
                cancelText="Keep it"
                onConfirm={onVoid}
              >
                <Button danger icon={<StopOutlined />}>
                  Void label
                </Button>
              </Popconfirm>
            )}
            <span className="ao-label-note">Bought {formatVegasFull(order.label_created_at)}</span>
          </div>
        ) : moving ? (
          <div className="ao-label-note">Marked {order.fulfillment_status} by hand; no label was bought here.</div>
        ) : (
          <div className="ao-label-actions">
            <Button type="primary" icon={<PrinterOutlined />} onClick={onBuy}>
              Buy label
            </Button>
            <span className="ao-label-note">Unless you pick a rate, it buys {defaultRateText(order)}.</span>
          </div>
        )}
      </div>
    </>
  );
};

// The rate picker's first choice: send no rate and let the API use the checkout's (see defaultRateText).
const CHECKOUT_RATE = "checkout";

interface BuyLabelModalProps {
  order: AccessOrder;
  onClose: () => void;
  onBought: (order: AccessOrder) => void;
  /** The order already has a label (bought meanwhile, or still being made): show it as it is now. */
  onStale: () => void;
}

/**
 * When the API's answer has no message, the server didn't answer in time (or Cloudflare stood in for it): Shippo may
 * have made the label all the same.
 */
const NO_ANSWER = "Couldn't buy the label: the server didn't answer. Open the order again before retrying: the label may have been bought.";

// Mounted only while open: each opening asks Shippo for today's rates.
const BuyLabelModal = ({ order, onClose, onBought, onStale }: BuyLabelModalProps) => {
  const [rates, setRates] = useState<ShippingRate[] | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [choice, setChoice] = useState(CHECKOUT_RATE);
  const [buying, setBuying] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    GetAccessOrderRates(order.id)
      .then((res) => {
        if (active) setRates(res.data.data.rates);
      })
      .catch((err) => {
        if (!active) return;
        setRates([]);
        setRatesError(apiErrorMessage(err) || "Couldn't get today's rates from Shippo");
      });
    return () => {
      active = false;
    };
  }, [order.id]);

  const buy = async () => {
    try {
      setBuying(true);
      setFailure(null);
      const res = await BuyAccessOrderLabel(order.id, choice === CHECKOUT_RATE ? undefined : choice);
      const bought = res.data.data;
      if (bought.label_url) message.success("Label bought. Print it from the order.");
      else message.info("Shippo is still making the label. Check again from the order in a minute.");
      onBought(bought);
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "LABEL_EXISTS" || code === "LABEL_PENDING") {
        message.warning(apiErrorMessage(err) || "This order already has a label");
        onStale();
      } else {
        // LABEL_FAILED carries Shippo's reasons; SHIPPO_UNAVAILABLE, NOTHING_TO_SHIP and NO_SHIPPING_RATES say what's wrong.
        setFailure(apiErrorMessage(err) || NO_ANSWER);
      }
    } finally {
      setBuying(false);
    }
  };

  const checkoutService = carrierAndService(order);
  const optionName = order.shipping_option ? OPTION_NAMES[order.shipping_option] : null;

  return (
    <Modal
      open
      className="ao-rate-modal"
      title={`Buy a label for ${order.order_number}`}
      okText="Buy label"
      onOk={buy}
      confirmLoading={buying}
      onCancel={onClose}
      width={580}
      destroyOnHidden
    >
      <p className="ao-label-note">
        Shippo charges the label to Glamlink's account; an unused label can be voided for a refund.
      </p>
      {failure && <Alert className="ao-label-alert" type="error" showIcon title={failure} />}
      {ratesError && (
        <Alert
          className="ao-label-alert"
          type="warning"
          showIcon
          title={ratesError}
          description="You can still buy with the first choice."
        />
      )}
      <Radio.Group
        className="ao-rates"
        orientation="vertical"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
      >
        <Radio value={CHECKOUT_RATE}>
          <div className="ao-rate-title">
            {order.shippo_rate_id
              ? `The rate chosen at checkout${checkoutService ? `: ${checkoutService}` : ""}${optionName ? ` (${optionName})` : ""}`
              : "Today's standard rate"}
          </div>
          <div className="ao-label-note">
            {order.shippo_rate_id
              ? "Once Shippo no longer sells it (after a week), today's rate for the same service is bought."
              : "Shipping was a flat price or free at checkout, so the customer didn't pick a service."}
          </div>
        </Radio>
        {rates === null ? (
          <Spin size="small" description="Getting today's rates…" />
        ) : (
          rates.map((rate) => (
            <Radio key={rate.rate_id} value={rate.rate_id}>
              <div className="ao-rate-title">
                {rate.provider} {rate.service} · {money(rate.amount_cents)}
              </div>
              <div className="ao-label-note">
                {rateDays(rate)}{" "}
                {rate.option && <Tag color="purple">{OPTION_NAMES[rate.option]} today</Tag>}
                {rate.attributes.map((tag) => (RATE_TAGS[tag] ? <Tag key={tag}>{RATE_TAGS[tag]}</Tag> : null))}
                {rate.provider === order.carrier && rate.service === order.service && (
                  <Tag color="blue">Chosen at checkout</Tag>
                )}
              </div>
            </Radio>
          ))
        )}
        {rates?.length === 0 && !ratesError && (
          <div className="ao-label-note">Shippo has no other rates for this parcel today.</div>
        )}
      </Radio.Group>
    </Modal>
  );
};

interface CancelOrderModalProps {
  order: AccessOrder;
  onClose: () => void;
  onCancelled: (order: AccessOrder) => void;
  /** The API refused because the order changed meanwhile (cancelled, or shipped): show it as it is now. */
  onStale: () => void;
}

// Mounted only while open, so each opening starts with no reason and no refusal.
const CancelOrderModal = ({ order, onClose, onCancelled, onStale }: CancelOrderModalProps) => {
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const cancel = async () => {
    try {
      setCancelling(true);
      setFailure(null);
      const res = await CancelAccessOrder(order.id, reason.trim() || undefined);
      message.success(`Order ${order.order_number} cancelled`);
      onCancelled(res.data.data);
    } catch (err) {
      // 409: already cancelled, or its keychain has shipped; the API's message says which.
      setFailure(apiErrorMessage(err) || "Couldn't cancel the order");
      if (apiErrorStatus(err) === 409) onStale();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Modal
      open
      className="ao-cancel-modal"
      title={`Cancel order ${order.order_number}?`}
      okText="Cancel order"
      okButtonProps={{ danger: true }}
      cancelText="Keep the order"
      onOk={cancel}
      confirmLoading={cancelling}
      onCancel={onClose}
      width={540}
      destroyOnHidden
    >
      <p>{CANCEL_EXPLANATION}</p>
      {failure && <Alert className="ao-label-alert" type="error" showIcon title={failure} />}
      <label className="ao-cancel-reason" htmlFor="ao-cancel-reason">
        Reason (optional)
      </label>
      <Input.TextArea
        id="ao-cancel-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Ordered twice by mistake"
        rows={2}
        maxLength={255}
      />
    </Modal>
  );
};

const AccessOrders = () => {
  const [orders, setOrders] = useState<AccessOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({ page: 1, search: "" });
  const [searchText, setSearchText] = useState("");
  // How many orders match, and the page size the API used (it may cap the one asked for).
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AccessOrderDetail | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [editStatus, setEditStatus] = useState<FulfillmentStatus | undefined>(undefined);
  const [editTracking, setEditTracking] = useState("");
  const [editTrackingLink, setEditTrackingLink] = useState("");
  const [buyingLabelFor, setBuyingLabelFor] = useState<AccessOrder | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<AccessOrder | null>(null);
  // The admin's order email links to /access-orders/:id.
  const { id: routeId } = useParams();
  const navigate = useNavigate();

  // The API pages, searches and filters. One request per change of filters; the answer to a superseded one is dropped.
  useEffect(() => {
    let current = true;
    const { page, search, payment_status, fulfillment_status } = filters;
    const params: AccessOrderListParams = { page, limit: PAGE_SIZE };
    if (search) params.search = search;
    if (payment_status === "cancelled") params.cancelled = "true";
    else if (payment_status) params.payment_status = payment_status;
    if (fulfillment_status) params.fulfillment_status = fulfillment_status;
    setLoading(true);
    GetAllAccessOrders(params)
      .then((res) => {
        if (!current) return;
        const body = res.data.data;
        const rows = Array.isArray(body?.data) ? body.data : [];
        setOrders(rows);
        setTotal(body?.pagination?.total ?? rows.length);
        setPageSize(body?.pagination?.limit || PAGE_SIZE);
      })
      .catch((err) => {
        console.error("Error loading access orders:", err);
        if (current) message.error(apiErrorMessage(err) || "Failed to load Access Orders");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [filters]);

  // The list follows the search box 300 ms after the last key, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      const search = searchText.trim();
      setFilters((f) => (f.search === search ? f : { ...f, search, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const openOrderDetails = async (id: number | string) => {
    try {
      const res = await GetAccessOrderById(id);
      const order = accessOrderFromResponse(res.data);

      setSelectedOrder(order);
      setEditStatus(order.fulfillment_status || undefined);
      setEditTracking(order.tracking_number || "");
      setEditTrackingLink(order.tracking_link || "");
      setDetailModalOpen(true);
    } catch (e) {
      message.error("Failed to load order details");
    }
  };

  useEffect(() => {
    if (routeId) openOrderDetails(routeId);
  }, [routeId]);

  const closeOrderDetails = () => {
    setDetailModalOpen(false);
    // Off the order's own address, so a refresh doesn't open it again.
    if (routeId) navigate("/access-orders", { replace: true });
  };

  /**
   * Shows an order the API answered (after buying or voiding its label, or cancelling it) in the list and the open
   * details. Those answers leave out the card link, so it's kept from before.
   */
  const showOrder = (order: AccessOrder) => {
    const merge = (list: AccessOrder[]) => list.map((o) => (o.id === order.id ? { ...o, ...order } : o));
    setOrders(merge);
    setSelectedOrder((current) => (current?.id === order.id ? { ...current, ...order } : current));
    // The form below the label holds the tracking number too: keep it in step, or saving it would undo the label's.
    if (selectedOrder?.id === order.id) {
      setEditStatus(order.fulfillment_status || undefined);
      setEditTracking(order.tracking_number || "");
      setEditTrackingLink(order.tracking_link || "");
    }
  };

  const reloadOrder = async (id: number) => {
    try {
      const res = await GetAccessOrderById(id);
      showOrder(accessOrderFromResponse(res.data));
    } catch (e) {
      console.error(e);
    }
  };

  const voidLabel = async (order: AccessOrder) => {
    try {
      const res = await VoidAccessOrderLabel(order.id);
      const { order: voided, refund } = res.data.data;
      showOrder(voided);
      message.success(`Label voided. ${REFUND_WORDS[refund.status] ?? `Shippo's refund: ${refund.status}`}.`);
    } catch (e) {
      // LABEL_IN_USE: Shippo's tracking moved it on meanwhile; NO_LABEL: voided meanwhile.
      message.error(apiErrorMessage(e) || "Couldn't void the label");
      const code = apiErrorCode(e);
      if (code === "LABEL_IN_USE" || code === "NO_LABEL") reloadOrder(order.id);
    }
  };

  // A label Shippo was still making: asking for it again picks it up once done (the API buys nothing more).
  const checkLabel = async (order: AccessOrder) => {
    try {
      const res = await BuyAccessOrderLabel(order.id);
      showOrder(res.data.data);
      if (res.data.data.label_url) message.success("The label is ready. Print it from the order.");
      else message.info("Shippo is still making the label. Check again in a minute.");
    } catch (e) {
      if (apiErrorCode(e) === "LABEL_PENDING") {
        message.info(apiErrorMessage(e) || "Shippo is still making the label. Check again in a minute.");
      } else {
        message.error(apiErrorMessage(e) || "Couldn't reach the server. Try again in a moment.");
        reloadOrder(order.id);
      }
    }
  };

  const applyLocalUpdate = (orderId: number, changes: FulfillmentUpdate) => {
    const update = (list: AccessOrder[]) =>
      list.map((o) => (o.id === orderId ? { ...o, ...changes } : o));
    setOrders(update);
  };

  const quickUpdateFulfillment = async (orderId: number, status: FulfillmentStatus) => {
    const previous = orders;
    applyLocalUpdate(orderId, { fulfillment_status: status });

    try {
      await UpdateAccessOrderFulfillment(orderId, { fulfillment_status: status });
      message.success(`Marked as ${status.toUpperCase()}`);
    } catch (e) {
      setOrders(previous);
      message.error(
        apiErrorMessage(e) || "Failed to update fulfillment status",
      );
    }
  };

  const handleSaveOrderDetails = async () => {
    if (!selectedOrder) return;

    try {
      setSavingOrder(true);

      const payload: FulfillmentUpdate = {
        fulfillment_status: editStatus,
        tracking_number: editTracking || null,
        tracking_link: editTrackingLink || null,
      };

      await UpdateAccessOrderFulfillment(selectedOrder.id, payload);
      applyLocalUpdate(selectedOrder.id, payload);

      message.success("Order updated");
      closeOrderDetails();
    } catch (e) {
      message.error(apiErrorMessage(e) || "Failed to update order");
    } finally {
      setSavingOrder(false);
    }
  };

  // No modal, no fetch — same as the "View Card" chip in BusinessCard.jsx,
  // just opens the live public Access Card in a new tab.
  const viewAccessCard = (link: string | null | undefined) => {
    if (!link) {
      message.warning("No Access Card link found for this order");
      return;
    }
    window.open(link, "_blank", "noreferrer");
  };

  const columns: TableColumnsType<AccessOrder> = [
    {
      title: "Order",
      dataIndex: "order_number",
      render: (orderNumber, record) => {
        const { date, time } = formatVegasShort(record.created_at);
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{orderNumber}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
              {date} · {time} PT
            </div>
          </div>
        );
      },
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{name}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{record.customer_email}</div>
        </div>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount_paid",
      render: (amount, record) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            ${Number(amount || 0).toFixed(2)}
          </div>
          {/* A cancelled payment status is shown once, by the Cancelled tag. */}
          {record.payment_status !== "cancelled" && (
            <Pill
              text={paymentWords(record.payment_status)}
              type={record.payment_status}
            />
          )}
        </div>
      ),
    },
    {
      title: "Ship To",
      dataIndex: "shipping_address_line_1",
      render: (_, record) =>
        isPhysical(record) ? (
          <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 200 }}>
            <div style={{ fontWeight: 600 }}>{record.recipient_name}</div>
            <div style={{ color: "var(--color-text-secondary)" }}>
              {record.shipping_address_line_1}
              {record.shipping_address_line_2
                ? `, ${record.shipping_address_line_2}`
                : ""}
            </div>
            <div style={{ color: "var(--color-text-secondary)" }}>
              {record.shipping_city}, {record.shipping_state}{" "}
              {record.shipping_postal_code}
            </div>
          </div>
        ) : (
          // Access Pro bought alone: the order exists for the record, and nothing ships.
          <Tag color="purple">Access Pro only</Tag>
        ),
    },
    {
      title: "Fulfillment",
      dataIndex: "fulfillment_status",
      render: (status, record) =>
        isCancelled(record) ? (
          <Tooltip title="Nothing more ships for it, and any Access Pro bought with it has ended.">
            <Tag color="red">Cancelled</Tag>
          </Tooltip>
        ) : isPhysical(record) ? (
          <Select
            size="small"
            className="ao-fulfillment-select"
            value={status}
            style={{ width: 125 }}
            onChange={(value) => quickUpdateFulfillment(record.id, value)}
            options={FULFILLMENT_OPTIONS}
          />
        ) : (
          <span style={{ color: "var(--color-text-disabled)", fontSize: 11 }}>Nothing to ship</span>
        ),
    },
    {
      title: "Tracking",
      dataIndex: "tracking_number",
      render: (tracking, record) =>
        tracking ? (
          <div>
            {record.tracking_link ? (
              <a href={record.tracking_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                {tracking}
              </a>
            ) : (
              <span style={{ fontSize: 12 }}>{tracking}</span>
            )}
            {record.tracking_status && (
              <div>
                <TrackingTag status={record.tracking_status} />
              </div>
            )}
          </div>
        ) : (
          <span style={{ color: "var(--color-text-disabled)" }}>—</span>
        ),
    },
    {
      title: "Actions",
      align: "center",
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          <Tooltip title="View Order Details">
            <button
              type="button"
              className="ao-action-btn"
              onClick={() => openOrderDetails(record.id)}
            >
              <EyeOutlined />
            </button>
          </Tooltip>

          <Tooltip title="View Access Card">
            <button
              type="button"
              className="ao-action-btn"
              onClick={() => viewAccessCard(record.business_card?.business_card_link)}
            >
              <LinkOutlined />
            </button>
          </Tooltip>

          {record.label_url && (
            <Tooltip title="Print Label">
              <a
                className="ao-action-btn"
                href={record.label_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Print label"
              >
                <PrinterOutlined />
              </a>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="ao-page">
      <div className="ao-header">
        <div>
          <h3 className="ao-title">Access Orders</h3>
          <p className="ao-subtitle">
            Fulfill NFC keychain shipments · times shown in Las Vegas (Pacific)
          </p>
        </div>

        <div className="ao-filters">
          <Input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by name, email or order #"
            prefix={<SearchOutlined />}
            className="ao-search"
            size="large" />
          <Select<string>
            allowClear
            size="large"
            placeholder="Any payment"
            aria-label="Payment"
            value={filters.payment_status}
            onChange={(value) => setFilters((f) => ({ ...f, payment_status: value, page: 1 }))}
            options={PAYMENT_FILTERS}
            style={{ width: 150 }}
          />
          <Select<FulfillmentStatus>
            allowClear
            size="large"
            placeholder="Any fulfillment"
            aria-label="Fulfillment"
            value={filters.fulfillment_status}
            onChange={(value) => setFilters((f) => ({ ...f, fulfillment_status: value, page: 1 }))}
            options={FULFILLMENT_FILTERS}
            style={{ width: 170 }}
          />
        </div>
      </div>

      <Card className="ao-table-card" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          rowKey={(record) => record.id}
          dataSource={orders}
          loading={loading}
          locale={{
            emptyText:
              filters.search || filters.payment_status || filters.fulfillment_status
                ? "No orders match these filters"
                : "No orders yet",
          }}
          pagination={{
            current: filters.page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (count) => `${count.toLocaleString("en-US")} order${count === 1 ? "" : "s"}`,
            onChange: (page) => setFilters((f) => ({ ...f, page })),
          }}
        />
      </Card>

      {/* ===================== Order Details Modal ===================== */}
      <Modal
        className="ao-modal"
        title={null}
        open={detailModalOpen}
        onCancel={closeOrderDetails}
        width={600}
        footer={null}
        styles={{ body: { padding: 0 } }}
        centered
        style={{ borderRadius: 12, overflow: "hidden" }}
      >
        {selectedOrder && (
          <div>
            <div className="ao-modal-header">
              <div>
                <div className="ao-modal-eyebrow">Order</div>
                <h2 className="ao-modal-heading">{selectedOrder.order_number}</h2>
                <p className="ao-modal-subheading">
                  {formatVegasFull(selectedOrder.created_at)}
                </p>
              </div>
              {isCancelled(selectedOrder) ? (
                <Pill text="CANCELLED" type="cancelled" />
              ) : (
                <Pill
                  text={paymentWords(selectedOrder.payment_status)}
                  type={selectedOrder.payment_status}
                />
              )}
            </div>

            <div className="ao-modal-body">
              {isCancelled(selectedOrder) && (
                <Alert
                  className="ao-cancelled-alert"
                  type="error"
                  showIcon
                  title="This order is cancelled"
                  description={
                    (selectedOrder.cancelled_at ? `Cancelled ${formatVegasFull(selectedOrder.cancelled_at)}. ` : "") +
                    "Nothing more ships for it, and any Access Pro bought with it has ended. No refund was made here: a keychain is refunded manually in Stripe; subscriptions are not refunded." +
                    (selectedOrder.cancel_reason ? ` Reason: ${selectedOrder.cancel_reason}` : "")
                  }
                />
              )}
              <MoneyEvents order={selectedOrder} />
              <div className="ao-info-grid">
                <div className="ao-info-item">
                  <div className="label">Customer</div>
                  <div className="value">{selectedOrder.customer_name}</div>
                </div>
                <div className="ao-info-item">
                  <div className="label">Email</div>
                  <div className="value">{selectedOrder.customer_email}</div>
                </div>
                <div className="ao-info-item">
                  <div className="label">Amount Paid</div>
                  <div className="value">
                    ${Number(selectedOrder.amount_paid || 0).toFixed(2)}
                  </div>
                </div>
                <div className="ao-info-item">
                  <div className="label">Shipping Fee</div>
                  <div className="value">
                    ${Number(selectedOrder.shipping_amount || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <Tooltip title="Opens the live public Access Card in a new tab">
                <div
                  className="ao-link-btn"
                  onClick={() =>
                    viewAccessCard(selectedOrder.business_card?.business_card_link)
                  }
                >
                  <LinkOutlined /> View Access Card
                </div>
              </Tooltip>

              {selectedOrder.checkout && <CheckoutSummary checkout={selectedOrder.checkout} />}

              {isPhysical(selectedOrder) ? (
                <>
                  <div className="ao-section-label">
                    <EnvironmentOutlined /> Shipping Address
                  </div>
                  <div className="ao-box">
                    <strong>{selectedOrder.recipient_name}</strong>
                    <br />
                    {selectedOrder.shipping_address_line_1}
                    {selectedOrder.shipping_address_line_2
                      ? `, ${selectedOrder.shipping_address_line_2}`
                      : ""}
                    <br />
                    {selectedOrder.shipping_city}, {selectedOrder.shipping_state}{" "}
                    {selectedOrder.shipping_postal_code}
                    <br />
                    {selectedOrder.shipping_country}
                  </div>

                  <LabelSection
                    order={selectedOrder}
                    onBuy={() => setBuyingLabelFor(selectedOrder)}
                    onVoid={() => voidLabel(selectedOrder)}
                    onCheck={() => checkLabel(selectedOrder)}
                  />

                  {/* A cancelled order's fulfillment isn't changed by hand. */}
                  {!isCancelled(selectedOrder) && (
                    <>
                      <div className="ao-section-label">Fulfillment</div>
                      <p className="ao-label-note ao-fulfillment-note">
                        Buying a label fills in the tracking number and link, and Shippo's tracking moves the status
                        to shipped and delivered. Change them here for a parcel sent another way.
                      </p>

                      <div style={{ marginBottom: 14 }}>
                        <div className="ao-info-item" style={{ marginBottom: 12 }}>
                          <div className="label">Status</div>
                          <Select
                            value={editStatus}
                            style={{ width: "100%", marginTop: 4 }}
                            onChange={setEditStatus}
                            options={FULFILLMENT_OPTIONS}
                          />
                        </div>

                        <div className="ao-info-item" style={{ marginBottom: 12 }}>
                          <div className="label">Tracking Number</div>
                          <Input
                            value={editTracking}
                            onChange={(e) => setEditTracking(e.target.value)}
                            placeholder="e.g. 1Z999AA10123456784"
                            style={{ width: "100%", marginTop: 4 }}
                          />
                        </div>

                        <div className="ao-info-item">
                          <div className="label">Tracking Link (optional)</div>
                          <Input
                            value={editTrackingLink}
                            onChange={(e) => setEditTrackingLink(e.target.value)}
                            placeholder="https://carrier.com/track/..."
                            style={{ width: "100%", marginTop: 4 }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="ao-box" style={{ textAlign: "center", color: "var(--color-text-tertiary)" }}>
                  Access Pro only: nothing to ship.
                </div>
              )}

              {!isCancelled(selectedOrder) && (
                <div className="ao-modal-actions">
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => setCancellingOrder(selectedOrder)}
                  >
                    Cancel order
                  </Button>
                  <Button
                    className="ao-save-btn"
                    loading={savingOrder}
                    disabled={!isPhysical(selectedOrder)}
                    onClick={handleSaveOrderDetails}>Save Changes</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {buyingLabelFor && (
        <BuyLabelModal
          order={buyingLabelFor}
          onClose={() => setBuyingLabelFor(null)}
          onBought={(order) => {
            setBuyingLabelFor(null);
            showOrder(order);
          }}
          onStale={() => {
            setBuyingLabelFor(null);
            reloadOrder(buyingLabelFor.id);
          }}
        />
      )}

      {cancellingOrder && (
        <CancelOrderModal
          order={cancellingOrder}
          onClose={() => setCancellingOrder(null)}
          onCancelled={(order) => {
            setCancellingOrder(null);
            showOrder(order);
          }}
          // The refusal stays on screen; the details behind it show the order as it is now.
          onStale={() => reloadOrder(cancellingOrder.id)}
        />
      )}
    </div>
  );
};

export default AccessOrders;