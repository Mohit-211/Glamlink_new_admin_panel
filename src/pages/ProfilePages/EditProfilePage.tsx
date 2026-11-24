import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Alert, Button, Empty, Form, Input, Space, Spin, Tabs, Tag, message } from "antd";
import { BarChartOutlined, ExportOutlined } from "@ant-design/icons";
import PageHeader, { Panel } from "../../components/PageHeader";
import { GetPage, UpdatePage } from "../../services/Api/ProfilesApi";
import { apiErrorCode, apiErrorMessage, apiErrorStatus } from "../../utils/apiError";
import { showFieldError } from "../../utils/formErrors";
import type { PageView } from "../../types/profile";
import ClaimEmailButton from "./ClaimEmailButton";
import EducationTab from "./EducationTab";
import MediaTab from "./MediaTab";
import PageFields from "./PageFields";
import TaggedTab from "./TaggedTab";
import { canSetEmail, fallbacksOf, hasMapSwitch, toFormValues, toPageUpdate, type PageFormValues } from "./pageForm";
import {
  TYPE_COLOR,
  TYPE_LABEL,
  hiddenReasons,
  publicPageUrl,
  shortUrl,
  usePageRouteState,
  type PageRouteState,
} from "./pageStatus";
import styles from "./ProfilePages.module.scss";
import { paths } from "../../paths";

/** Whether the page shows on the website, why not, and the links to it and its card. */
const PageStatus = ({ view }: { view: PageView }) => {
  const card = view.public.access_card;
  const notes: string[] = [];
  if (view.page.created_by_admin) notes.push("A brand page an admin made: it shows without an Access card.");
  if (view.page.is_on_map === false) {
    notes.push("Off the directory's map: an admin took the pin off. The page and the directory's list still show it.");
  }
  if (view.public.listing) {
    notes.push("It has an approved directory listing, which fills in what the page and the card leave empty.");
  }
  const links = (
    <div className={styles.statusLinks}>
      {view.visible && view.slug && (
        <a href={publicPageUrl(view.slug)} target="_blank" rel="noopener noreferrer">
          {shortUrl(publicPageUrl(view.slug))} <ExportOutlined />
        </a>
      )}
      {card ? (
        <a href={card.url} target="_blank" rel="noopener noreferrer">
          Access card <ExportOutlined />
        </a>
      ) : (
        <span className={styles.muted}>No live Access card</span>
      )}
    </div>
  );
  const description = (
    <>
      {!view.visible && (
        <ul className={styles.reasons}>
          {hiddenReasons(view).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {notes.map((note) => (
        <div key={note}>{note}</div>
      ))}
      {links}
    </>
  );
  return (
    <Alert
      type={view.visible ? "success" : "warning"}
      showIcon
      title={view.visible ? "Shown on the website" : "Hidden from the website"}
      description={description}
      className={styles.block}
    />
  );
};

const TABS = ["page", "media", "education", "tagged"] as const;
type TabKey = (typeof TABS)[number];

const asTab = (value: string | null): TabKey => TABS.find((tab) => tab === value) ?? "page";

const PageScreen = ({ userId }: { userId: string }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = usePageRouteState();
  // `?tab=` opens a tab (and keeps it on reload).
  const [params, setParams] = useSearchParams();
  const tab = asTab(params.get("tab"));
  const [form] = Form.useForm<PageFormValues>();
  const [view, setView] = useState<PageView | null>(null);
  const [problem, setProblem] = useState<"not_found" | "failed" | null>(() =>
    /^\d+$/.test(userId) ? null : "not_found",
  );
  const [saving, setSaving] = useState(false);
  // Whether the account has a password. The page's view says so since Nov 24; before, only the list knew (the route's
  // state), so it was unknown when the page was opened directly.
  const [claimed, setClaimed] = useState(routeState.claimed);
  const back = routeState.from ?? paths.profilePages;

  useEffect(() => {
    if (!/^\d+$/.test(userId)) return;
    let current = true;
    GetPage(userId)
      .then((res) => {
        if (!current) return;
        setView(res.data.data);
        if (typeof res.data.data.claimed === "boolean") setClaimed(res.data.data.claimed);
      })
      .catch((err) => {
        if (!current) return;
        console.error("Error loading the page:", err);
        if (apiErrorStatus(err) === 404) setProblem("not_found");
        else {
          setProblem("failed");
          message.error(apiErrorMessage(err) || "Couldn't load the page");
        }
      });
    return () => {
      current = false;
    };
  }, [userId]);

  const save = async (values: PageFormValues) => {
    if (!view) return;
    const update = toPageUpdate(values, view.slug ?? "");
    // The sign-in email goes only when it may be set here and has changed ("" clears it).
    const email = (values.email ?? "").trim();
    if (canSetEmail(view, claimed) && email !== (view.email ?? "")) update.email = email;
    setSaving(true);
    try {
      const res = await UpdatePage(view.user_id, update);
      setView(res.data.data);
      if (typeof res.data.data.claimed === "boolean") setClaimed(res.data.data.claimed);
      // The API cleans what it saves (links get https://, the address is written as a slug): show that.
      form.setFieldsValue(toFormValues(res.data.data));
      message.success("Page saved");
    } catch (err) {
      const code = apiErrorCode(err);
      // The email's refusals (Nov 24) name no field: they go on it. Nothing was saved.
      const emailRefusal: Partial<Record<string, string>> = {
        ACCOUNT_EXISTS: "This email already has an account: it can't be this brand's.",
        ALREADY_CLAIMED: "Someone has signed in to this account: its owner changes the email.",
        EMAIL_NOT_EDITABLE: apiErrorMessage(err) || "This account's email can't be set here.",
      };
      if (code && emailRefusal[code] && "email" in update) {
        form.setFields([{ name: "email", errors: [emailRefusal[code]!] }]);
        form.scrollToField("email", { block: "center" });
        if (code === "ALREADY_CLAIMED") setClaimed(true);
        message.error("Nothing was saved: the email can't be used");
        return;
      }
      const fieldError = code === "INVALID_PAGE" ? showFieldError(form, err) : null;
      message.error(fieldError || apiErrorMessage(err) || "Couldn't save the page");
    } finally {
      setSaving(false);
    }
  };

  if (problem || !view) {
    return (
      <div>
        <PageHeader title="Page" back={back} />
        <Panel>
          {problem === "not_found" ? (
            <Empty
              description="No page for this account. Only active professional and brand accounts have one: this one may have been deleted, merged into another or be a client's."
            />
          ) : problem === "failed" ? (
            <Empty description="The page couldn't be loaded. Try again in a moment." />
          ) : (
            <div className={styles.panelBody}>
              <Spin />
            </div>
          )}
        </Panel>
      </div>
    );
  }

  const { public: shown } = view;
  const nextState: PageRouteState = { claimed, from: routeState.from };
  // Nov 24: a brand page may have no email yet (null; an API from before always had one).
  const noEmail = view.email === null;
  const emailField = canSetEmail(view, claimed);
  const claimButton = (type?: "primary") => (
    <ClaimEmailButton
      userId={view.user_id}
      type={type}
      onClaimed={() => setClaimed(true)}
      disabledReason={noEmail ? "No email yet: add the brand's email on the Page tab, then send the claim email." : undefined}
    />
  );

  return (
    <div>
      <PageHeader
        title={shown.name || `Account #${view.user_id}`}
        subtitle={
          <Space size={6} wrap>
            {shown.type && <Tag color={TYPE_COLOR[shown.type]}>{TYPE_LABEL[shown.type]}</Tag>}
            {claimed === false && <Tag color="gold">Unclaimed</Tag>}
            {noEmail && <Tag>No email yet</Tag>}
            <span>Account #{view.user_id}</span>
            {view.email && <span>{view.email}</span>}
          </Space>
        }
        back={back}
        extra={
          <>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => navigate(paths.profilePageAnalytics(view.user_id), { state: nextState })}
            >
              Analytics
            </Button>
            {view.visible && view.slug && (
              <Button icon={<ExportOutlined />} href={publicPageUrl(view.slug)} target="_blank" rel="noopener noreferrer">
                View on site
              </Button>
            )}
            {claimed !== true && !routeState.created && claimButton()}
          </>
        }
      />

      {routeState.created && claimed !== true && (
        <Alert
          type="success"
          showIcon
          title="Brand page created"
          description={
            noEmail
              ? "It shows on the website without an Access card. It has no email yet: add the brand's email below, then send it a claim email so it can sign in and edit its page."
              : "It shows on the website without an Access card. When the brand is ready, send it a claim email so it can sign in and edit its page."
          }
          action={claimButton("primary")}
          className={styles.block}
        />
      )}

      <PageStatus view={view} />

      <Panel>
        <Tabs
          activeKey={tab}
          // The route's state (where "back" goes, whether the page was just made) stays with the new address.
          onChange={(key) => setParams({ tab: key }, { replace: true, state: location.state })}
          items={[
            {
              key: "page",
              label: "Page",
              children: (
                <Form<PageFormValues>
                  form={form}
                  layout="vertical"
                  initialValues={toFormValues(view)}
                  onFinish={save}
                  scrollToFirstError
                  className={styles.form}
                >
                  {emailField && (
                    <>
                      <h4 className={styles.sectionTitle}>Sign-in email</h4>
                      <Form.Item
                        name="email"
                        label="Email"
                        rules={[{ type: "email", message: "Enter a valid email address" }]}
                        extra="The brand signs in with it, and the claim email goes there. It can be set here until someone signs in or the brand has an Access card. Changing it stops a claim link already sent to the old address."
                      >
                        <Input type="email" placeholder="No email yet" maxLength={200} />
                      </Form.Item>
                    </>
                  )}
                  <PageFields
                    fallbacks={fallbacksOf(view)}
                    savedSlug={view.slug ?? ""}
                    type={shown.type}
                    mapSwitch={hasMapSwitch(view)}
                  />
                  <div className={styles.formActions}>
                    <Button type="primary" htmlType="submit" loading={saving}>
                      Save page
                    </Button>
                    <Button onClick={() => form.resetFields()} disabled={saving}>
                      Undo changes
                    </Button>
                  </div>
                </Form>
              ),
            },
            {
              key: "media",
              label: "Media & Images",
              children: <MediaTab userId={view.user_id} hasCard={Boolean(shown.access_card)} />,
            },
            {
              key: "education",
              label: "Education",
              children: <EducationTab userId={view.user_id} page={{ slug: view.slug, visible: view.visible }} />,
            },
            {
              key: "tagged",
              label: "Tagged in",
              children: <TaggedTab slug={view.slug} visible={view.visible} />,
            },
          ]}
        />
      </Panel>
    </div>
  );
};

/**
 * One page's screen (route /pages/:userId, `?tab=` page, media, education or tagged): how it stands, the fields an
 * admin sets on it, its Media & Images and Education, and where it is tagged. Another account's id starts a fresh
 * screen, so no form value carries over.
 */
const EditProfilePage = () => {
  const { userId = "" } = useParams();
  return <PageScreen key={userId} userId={userId} />;
};

export default EditProfilePage;
