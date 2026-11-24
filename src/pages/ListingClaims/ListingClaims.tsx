import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Modal, Segmented, Table, Tag, Tooltip, message, type TableColumnsType } from "antd";
import { CheckOutlined, CloseOutlined, ExportOutlined } from "@ant-design/icons";
import { Link, useSearchParams } from "react-router";
import dayjs from "dayjs";
import PageHeader, { Panel } from "../../components/PageHeader";
import { GetListingClaims, ReviewListingClaim } from "../../services/Api/ListingClaimsApi";
import { apiErrorMessage, apiErrorStatus } from "../../utils/apiError";
import { recountBadges } from "../../utils/badges";
import { CARD_TYPE_COLOR, CARD_TYPE_LABEL, cardTypeOf } from "../BusinessCard/cardType";
import type { ClaimAction, ClaimStatus, ListingClaim } from "../../types/listingClaim";
import styles from "./ListingClaims.module.scss";
import { paths } from "../../paths";

// The API's largest page.
const PAGE_SIZE = 50;

type StatusFilter = ClaimStatus | "all";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "To verify" },
  { value: "verified", label: "Verified" },
  { value: "all", label: "All" },
];

const EMPTY_TEXT: Record<StatusFilter, string> = {
  pending: "No claims waiting to be verified",
  verified: "No verified claims",
  all: "No claims yet",
};

/** The card's own status (draft, pending, accepted or rejected), which the claim doesn't change. */
const CARD_STATUS: Partial<Record<string, { label: string; color?: string; hint: string }>> = {
  draft: { label: "Draft", hint: "A guest's card, not live until they choose a plan or pay." },
  pending: { label: "Pending", color: "gold", hint: "The card waits for review under Card Requests." },
  accepted: { label: "Accepted", color: "green", hint: "The card is live." },
  rejected: { label: "Rejected", color: "red", hint: "The card was rejected under Card Requests." },
};

// The filter and page live in the address, so coming back from a card finds the list as it was.
const filtersFrom = (params: URLSearchParams) => ({
  status: FILTERS.find((f) => f.value === params.get("status"))?.value ?? "pending",
  page: Math.max(1, Number.parseInt(params.get("page") ?? "", 10) || 1),
});

type Filters = ReturnType<typeof filtersFrom>;

const queryOf = ({ status, page }: Filters) => {
  const query = new URLSearchParams();
  if (status !== "pending") query.set("status", status);
  if (page > 1) query.set("page", String(page));
  return query;
};

const plural = (count: number, word: string) => `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;

const DateCell = ({ value }: { value: string }) => (
  <div>
    <div>{dayjs(value).format("MMM D, YYYY")}</div>
    <div className={styles.subText}>{dayjs(value).format("h:mm A")}</div>
  </div>
);

/** Google's page for the listing: the API builds it, but only a web link is opened. */
const MapsLink = ({ claim, children }: { claim: ListingClaim; children: React.ReactNode }) =>
  /^https?:\/\//i.test(claim.maps_url) ? (
    <a href={claim.maps_url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <span className={styles.muted}>{claim.place_id ?? "-"}</span>
  );

/**
 * Whether the claim keeps the listing out of the directory's Google results: since Nov 24, while its card is live,
 * verified or not. An API from before answers no `hides_listing`: then only a verified claim did.
 */
const hidesListing = (claim: ListingClaim) => claim.hides_listing ?? Boolean(claim.verified_at);

/** Whether the directory's Google results show the listing now. */
const GoogleResults = ({ claim }: { claim: ListingClaim }) =>
  hidesListing(claim) ? (
    <Tooltip title="The card is live, so the listing is out of the directory's Google results, checked or not. Rejecting the claim brings it back.">
      <Tag color="volcano">Hidden from Google results</Tag>
    </Tooltip>
  ) : (
    <Tooltip title="The card isn't live yet: the listing leaves the directory's Google results once it is.">
      <Tag>Still in Google results</Tag>
    </Tooltip>
  );

interface ReviewClaimModalProps {
  claim: ListingClaim;
  action: ClaimAction;
  onClose: () => void;
  onReviewed: () => void;
  /** No claim on the card any more (rejected meanwhile): the list reloads. */
  onGone: () => void;
}

// Mounted only while open, so each opening starts with no refusal.
const ReviewClaimModal = ({ claim, action, onClose, onReviewed, onGone }: ReviewClaimModalProps) => {
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const verifying = action === "verify";
  const hides = hidesListing(claim);

  const submit = async () => {
    try {
      setSaving(true);
      setRefusal(null);
      await ReviewListingClaim(claim.business_card_id, action);
      message.success(
        verifying ? "Claim verified" : hides ? "Claim rejected: the Google listing is back in the directory" : "Claim rejected",
      );
      onReviewed();
    } catch (err) {
      // 409 PLACE_ALREADY_CLAIMED: another card's verified claim has the listing, and the message names the card.
      setRefusal(apiErrorMessage(err) || `Couldn't ${action} the claim`);
      if (apiErrorStatus(err) === 404) onGone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={verifying ? "Verify this claim?" : "Reject this claim?"}
      okText={verifying ? "Verify" : "Reject"}
      okButtonProps={{ danger: !verifying }}
      confirmLoading={saving}
      onOk={submit}
      onCancel={onClose}
      width={560}
      destroyOnHidden
    >
      <p className={styles.claimant}>
        <strong>{claim.name}</strong>
        {claim.business_name ? ` (${claim.business_name})` : ""} claims a Google listing in the directory.
      </p>
      <ul className={styles.explain}>
        {verifying ? (
          <>
            <li>
              Check first that the claim is genuine: compare the card's name, business and email with{" "}
              <MapsLink claim={claim}>the listing on Google Maps</MapsLink>.
            </li>
            <li>
              {hides
                ? "The listing is already out of the directory's Google results, as the card is live. Verifying marks the claim as checked."
                : "Verifying marks the claim as checked. The listing leaves the directory's Google results once the card is live."}
            </li>
          </>
        ) : (
          <>
            <li>The claim is taken off the card; the card itself doesn't change.</li>
            <li>{hides ? "The Google listing shows in the directory again." : "The Google listing stays in the directory."}</li>
          </>
        )}
      </ul>
      {refusal && <Alert className={styles.refusal} type="error" showIcon title={refusal} />}
    </Modal>
  );
};

/**
 * Claims of the directory's Google listings, made through the Access form. Since Nov 24 a claim hides its Google listing
 * as soon as its card is live, before anyone checks it: verifying marks it checked, rejecting clears it from the card
 * and brings the listing back.
 */
const ListingClaims = () => {
  const [params, setParams] = useSearchParams();
  const { status, page } = filtersFrom(params);
  const [rows, setRows] = useState<ListingClaim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [review, setReview] = useState<{ claim: ListingClaim; action: ClaimAction } | null>(null);

  const setFilters = useCallback(
    (next: Partial<Filters>) => setParams((prev) => queryOf({ ...filtersFrom(prev), ...next }), { replace: true }),
    [setParams],
  );

  // One request per change of filters; the answer to a superseded one is dropped.
  useEffect(() => {
    let current = true;
    setLoading(true);
    GetListingClaims({ status: status === "all" ? undefined : status, page, limit: PAGE_SIZE })
      .then((res) => {
        if (!current) return;
        setRows(res.data.data.rows);
        setTotal(res.data.data.count);
      })
      .catch((err) => {
        console.error("Error loading listing claims:", err);
        if (current) message.error(apiErrorMessage(err) || "Couldn't load the listing claims");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [status, page, reloads]);

  const reload = () => setReloads((n) => n + 1);

  const reviewed = (action: ClaimAction) => {
    setReview(null);
    recountBadges();
    // A rejected claim leaves every view, a verified one the pending view: step back a page when this one empties.
    const leaves = action === "reject" || status === "pending";
    if (leaves && page > 1 && rows.length === 1) setFilters({ page: page - 1 });
    else reload();
  };

  const columns: TableColumnsType<ListingClaim> = [
    {
      title: "Card",
      key: "card",
      width: 220,
      fixed: "left",
      render: (_, row) => (
        <div>
          <Tooltip title="Open the card">
            <Link to={paths.card(row.business_card_id)} className={styles.primaryCell}>
              {row.name}
            </Link>
          </Tooltip>
          <div className={styles.subText}>{row.business_name || "-"}</div>
        </div>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      width: 220,
      render: (email: string | null) => (email ? <a href={`mailto:${email}`}>{email}</a> : "-"),
    },
    {
      title: "Type",
      key: "type",
      width: 120,
      render: (_, row) => {
        const type = cardTypeOf(row);
        return <Tag color={CARD_TYPE_COLOR[type]}>{CARD_TYPE_LABEL[type]}</Tag>;
      },
    },
    {
      title: "Card status",
      key: "status",
      width: 120,
      render: (_, row) => {
        const known = CARD_STATUS[row.status];
        return known ? (
          <Tooltip title={known.hint}>
            <Tag color={known.color}>{known.label}</Tag>
          </Tooltip>
        ) : (
          <Tag>{row.status}</Tag>
        );
      },
    },
    {
      title: "Google listing",
      key: "listing",
      width: 220,
      render: (_, row) => (
        <div className={styles.listingCell}>
          <MapsLink claim={row}>
            Open on Google Maps <ExportOutlined />
          </MapsLink>
          <GoogleResults claim={row} />
        </div>
      ),
    },
    {
      title: "Claimed",
      dataIndex: "created_at",
      width: 130,
      render: (date: string) => <DateCell value={date} />,
    },
    {
      title: "Verified",
      dataIndex: "verified_at",
      width: 130,
      render: (date: string | null) => (date ? <DateCell value={date} /> : <Tag color="gold">To verify</Tag>),
    },
    {
      title: "",
      key: "actions",
      width: 190,
      fixed: "right",
      render: (_, row) => (
        <div className={styles.rowActions}>
          {!row.verified_at && (
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => setReview({ claim: row, action: "verify" })}
            >
              Verify
            </Button>
          )}
          <Button size="small" danger icon={<CloseOutlined />} onClick={() => setReview({ claim: row, action: "reject" })}>
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Listing Claims"
        subtitle="Businesses claimed from the directory's Google listings through the Access form. A claim takes its Google listing out of the directory's Google results as soon as its card is live, before anyone checks it: reject a false claim quickly to bring the listing back, verify a genuine one."
        extra={
          <Segmented<StatusFilter>
            options={FILTERS}
            value={status}
            onChange={(next) => setFilters({ status: next, page: 1 })}
          />
        }
      />
      <Panel>
        <Table<ListingClaim>
          columns={columns}
          dataSource={rows}
          rowKey="business_card_id"
          loading={loading}
          size="middle"
          scroll={{ x: 1300 }}
          locale={{ emptyText: EMPTY_TEXT[status] }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (count) => plural(count, "claim"),
            onChange: (next) => setFilters({ page: next }),
          }}
        />
      </Panel>
      {review && (
        <ReviewClaimModal
          claim={review.claim}
          action={review.action}
          onClose={() => setReview(null)}
          onReviewed={() => reviewed(review.action)}
          onGone={reload}
        />
      )}
    </div>
  );
};

export default ListingClaims;
