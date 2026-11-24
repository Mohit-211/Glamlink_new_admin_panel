import React, { useState } from "react";
import { Link } from "react-router";
import {
  Alert,
  Button,
  Popconfirm,
  Segmented,
  Table,
  Tag,
  Tooltip,
  Upload,
  message,
  type TableColumnsType,
  type UploadProps,
} from "antd";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import PageHeader, { Panel } from "../../components/PageHeader";
import { GetBrandImportTemplate, ImportBrands as ImportBrandsFile } from "../../services/Api/ProfilesApi";
import { apiErrorCode, apiErrorMessage } from "../../utils/apiError";
import { asCsvFile, saveFile } from "../../utils/csv";
import type { BrandImportResult, BrandImportRow } from "../../types/profile";
import { plural } from "./pageContent";
import styles from "./ProfilePages.module.scss";
import { paths } from "../../paths";

/** The API refuses a bigger file (400 INVALID_CSV), so it's turned away here first. */
const MAX_BYTES = 2 * 1024 * 1024;

const TEMPLATE_NAME = "glamlink-brands-template.csv";

/** The columns the import reads (headers in any case; others are listed as ignored). */
const COLUMNS =
  "name (required), email, website, instagram, tiktok, facebook, youtube, linkedin, category, shipping, tagline, intro, about, slug, listed, featured, image, cover_image";

const STATUS: Record<BrandImportRow["status"], { label: string; color?: string; hint: string }> = {
  ready: { label: "Ready", color: "blue", hint: "Importing makes this brand page." },
  created: { label: "Created", color: "green", hint: "The brand page was made." },
  skipped: { label: "Skipped", hint: "Already here, nothing wrong: importing leaves it alone." },
  failed: { label: "Failed", color: "red", hint: "Fix the row in the spreadsheet and upload the file again." },
};

/** The rows worth a look: skipped, failed, or made without something. */
const needsLook = (row: BrandImportRow) => row.status === "skipped" || row.status === "failed" || row.warnings.length > 0;

/** What a row's code means, when its message alone doesn't say. */
const CODE_HINT: Partial<Record<string, string>> = {
  ACCOUNT_EXISTS: "This email already has an account.",
  BRAND_EXISTS: "A brand of this name is already here.",
  DUPLICATE_IN_FILE: "An earlier row of the file has this name or email.",
};

const columns: TableColumnsType<BrandImportRow> = [
  { title: "Row", dataIndex: "row", width: 70 },
  {
    title: "Brand",
    key: "brand",
    width: 240,
    render: (_, row) => (
      <div>
        <div>{row.name || <span className={styles.muted}>No name</span>}</div>
        {row.user_id !== null && (row.status === "created" || row.status === "skipped") && (
          <Link to={paths.profilePage(row.user_id)} className={styles.sub}>
            {row.status === "created" ? "Open the new page" : "Open its page"}
          </Link>
        )}
      </div>
    ),
  },
  {
    title: "Email",
    dataIndex: "email",
    width: 220,
    render: (email: string | null) => email || <span className={styles.muted}>None</span>,
  },
  {
    title: "Result",
    dataIndex: "status",
    width: 110,
    render: (status: BrandImportRow["status"]) => (
      <Tooltip title={STATUS[status].hint}>
        <Tag color={STATUS[status].color}>{STATUS[status].label}</Tag>
      </Tooltip>
    ),
  },
  {
    title: "Details",
    key: "details",
    render: (_, row) => {
      const why = row.message || (row.code ? CODE_HINT[row.code] : null);
      if (!why && !row.warnings.length) return <span className={styles.muted}>-</span>;
      return (
        <div className={styles.importDetails}>
          {why && <div>{why}</div>}
          {row.warnings.map((warning) => (
            <div key={warning} className={styles.importWarning}>
              {warning}
            </div>
          ))}
        </div>
      );
    },
  },
];

/** The counts of a check or an import, as tiles. */
const Counts = ({ result }: { result: BrandImportResult }) => {
  const tiles = [
    { label: "Rows", value: result.total },
    result.dry_run ? { label: "Ready to import", value: result.ready } : { label: "Created", value: result.created },
    { label: "Skipped", value: result.skipped },
    { label: "Failed", value: result.failed },
    { label: "With warnings", value: result.with_warnings },
  ];
  return (
    <div className={styles.importCounts}>
      {tiles.map((tile) => (
        <div key={tile.label} className={styles.tile}>
          <div className={styles.tileLabel}>{tile.label}</div>
          <div className={styles.tileValue}>{tile.value.toLocaleString("en-US")}</div>
        </div>
      ))}
    </div>
  );
};

/**
 * "Import brands" (route /professionals/pages/import): many brand pages at once from a CSV (Nov 24). Each row becomes a
 * brand page without a login, as "New brand page" makes one. Check is a dry run of the file; Import sends the same file
 * again for real. The report stays on screen. No email goes out: brands are invited one by one from their pages.
 */
const ImportBrands = () => {
  const [file, setFile] = useState<File | null>(null);
  // The dry run of `file`, then (after Import) what the import made.
  const [checked, setChecked] = useState<BrandImportResult | null>(null);
  const [imported, setImported] = useState<BrandImportResult | null>(null);
  const [busy, setBusy] = useState<"template" | "check" | "import" | null>(null);
  // The file as a whole can't be imported (400 INVALID_CSV): the API's reason.
  const [problem, setProblem] = useState<string | null>(null);
  const [show, setShow] = useState<"look" | "all">("look");

  const report = imported ?? checked;
  const lookRows = report ? report.rows.filter(needsLook) : [];

  const downloadTemplate = async () => {
    setBusy("template");
    try {
      saveFile((await GetBrandImportTemplate()).data, TEMPLATE_NAME);
    } catch (err) {
      message.error(apiErrorMessage(err) || "Couldn't download the template");
    } finally {
      setBusy(null);
    }
  };

  const pick: UploadProps["beforeUpload"] = (picked) => {
    if (!/\.csv$/i.test(picked.name)) {
      message.error("Pick a .csv file: in the spreadsheet app, save or export the sheet as CSV first.");
      return Upload.LIST_IGNORE;
    }
    if (picked.size > MAX_BYTES) {
      message.error("The file is over 2 MB: split it into smaller files.");
      return Upload.LIST_IGNORE;
    }
    setFile(picked);
    setChecked(null);
    setImported(null);
    setProblem(null);
    return false; // kept here; Check and Import send it
  };

  const send = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(dryRun ? "check" : "import");
    setProblem(null);
    try {
      const result = (await ImportBrandsFile(asCsvFile(file), { dryRun })).data.data;
      if (dryRun) setChecked(result);
      else {
        setImported(result);
        message.success(result.created ? `${plural(result.created, "brand page")} made` : "No brand page was made");
      }
      setShow(result.rows.some(needsLook) ? "look" : "all");
    } catch (err) {
      if (apiErrorCode(err) === "INVALID_CSV") {
        setProblem(apiErrorMessage(err) || "The file can't be read as a CSV.");
        if (dryRun) setChecked(null);
      } else {
        message.error(apiErrorMessage(err) || (dryRun ? "Couldn't check the file" : "Couldn't import the file"));
      }
    } finally {
      setBusy(null);
    }
  };

  const startOver = () => {
    setFile(null);
    setChecked(null);
    setImported(null);
    setProblem(null);
  };

  const ready = checked?.ready ?? 0;

  return (
    <div>
      <PageHeader
        title="Import brands"
        subtitle="Many brand pages at once, from a CSV. Each row becomes a brand page without a login, as New brand page makes one: it shows on the website at once, without an Access card. No email goes out: invite brands one by one from their pages."
        back={paths.profilePages}
      />

      <Panel>
        <div className={styles.form}>
          <h4 className={styles.sectionTitle}>1. Fill in the template</h4>
          <p className={styles.importText}>
            One row per brand. Only the name is required; a brand without an email gets one later, on its page, before
            its claim email. Columns: {COLUMNS}. At most 500 rows and 2 MB a file; Excel's CSV (UTF-8 or not) with
            commas, semicolons or tabs is fine.
          </p>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate} loading={busy === "template"}>
            Download the template
          </Button>

          <h4 className={styles.sectionTitle}>2. Pick the file</h4>
          <Upload.Dragger
            accept=".csv,text/csv"
            multiple={false}
            beforeUpload={pick}
            fileList={file ? [{ uid: "csv", name: file.name, status: "done" }] : []}
            onRemove={() => {
              startOver();
              return true;
            }}
            disabled={busy === "check" || busy === "import"}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag the CSV here</p>
          </Upload.Dragger>

          <h4 className={styles.sectionTitle}>3. Check it, then import</h4>
          <p className={styles.importText}>
            Check reads every row and makes nothing. Rows already here (an email with an account, or a brand of the same
            name) are skipped, so importing the same file twice adds nothing the second time.
          </p>
          {problem && (
            <Alert type="error" showIcon title="The file can't be imported" description={problem} className={styles.block} />
          )}
          <div className={styles.importActions}>
            <Button onClick={() => send(true)} loading={busy === "check"} disabled={!file || Boolean(imported) || busy !== null}>
              Check
            </Button>
            <Popconfirm
              title={`Make ${plural(ready, "brand page")}?`}
              description="They show on the website at once (rows with listed = no stay hidden). Skipped and failed rows are left out."
              okText="Import"
              cancelText="Not yet"
              onConfirm={() => send(false)}
              disabled={!ready || Boolean(imported) || busy !== null}
            >
              <Button type="primary" loading={busy === "import"} disabled={!ready || Boolean(imported) || busy !== null}>
                {ready ? `Import ${plural(ready, "brand")}` : "Import"}
              </Button>
            </Popconfirm>
            {imported && <Button onClick={startOver}>Import another file</Button>}
          </div>
        </div>
      </Panel>

      {report && (
        <Panel>
          <div className={styles.panelBody}>
            <div className={styles.panelHead}>
              <h4 className={styles.panelTitle}>
                {report.dry_run ? `Checked: ${file?.name ?? "the file"}` : `Imported: ${file?.name ?? "the file"}`}
              </h4>
              <Segmented<"look" | "all">
                value={show}
                onChange={setShow}
                options={[
                  { value: "look", label: `Needs a look (${lookRows.length})` },
                  { value: "all", label: `All rows (${report.rows.length})` },
                ]}
              />
            </div>
            <Alert
              type={report.failed ? "warning" : "success"}
              showIcon
              className={styles.block}
              title={
                report.dry_run
                  ? `${plural(report.ready, "brand")} ready to import; nothing was made yet.`
                  : `${plural(report.created, "brand page")} made.`
              }
              description={[
                report.skipped ? `${plural(report.skipped, "row")} skipped: already here.` : "",
                report.failed
                  ? `${plural(report.failed, "row")} failed: fix ${report.failed === 1 ? "it" : "them"} in the spreadsheet and upload ${report.failed === 1 ? "it" : "them"} again.`
                  : "",
                report.with_warnings ? `${plural(report.with_warnings, "row")} with warnings: made without what the warning names.` : "",
                report.ignored_columns.length ? `Columns not read: ${report.ignored_columns.join(", ")}.` : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
            <Counts result={report} />
            <Table<BrandImportRow>
              rowKey="row"
              columns={columns}
              dataSource={show === "look" ? lookRows : report.rows}
              size="middle"
              scroll={{ x: 900 }}
              pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }}
              locale={{ emptyText: show === "look" ? "Every row is fine" : "No rows" }}
            />
          </div>
        </Panel>
      )}
    </div>
  );
};

export default ImportBrands;
