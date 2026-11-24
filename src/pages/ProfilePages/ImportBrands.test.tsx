import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import axios from "axios";
import ImportBrands from "./ImportBrands";
import type { BrandImportResult, BrandImportRow } from "../../types/profile";

// No network in tests: each test says what the import answers.
vi.mock("axios", () => {
  type Call = (...args: unknown[]) => Promise<unknown>;
  return {
    default: { get: vi.fn<Call>(), post: vi.fn<Call>() },
    isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean } | null)?.isAxiosError),
  };
});

const IMPORT = "https://api.test/api/v1/profiles/admin/brands/import";

const row = (fields: Partial<BrandImportRow>): BrandImportRow => ({
  row: 2,
  name: "Glow Co",
  email: "hello@glow.co",
  status: "ready",
  code: null,
  field: null,
  message: null,
  user_id: null,
  slug: "glow-co",
  warnings: [],
  ...fields,
});

const result = (fields: Partial<BrandImportResult>, rows: BrandImportRow[]): BrandImportResult => ({
  dry_run: true,
  total: rows.length,
  created: 0,
  ready: 0,
  skipped: 0,
  failed: 0,
  with_warnings: 0,
  ignored_columns: [],
  rows,
  ...fields,
});

// Three rows: one fine, one made without its website, one already here.
const CHECKED = result({ ready: 2, skipped: 1, with_warnings: 1, ignored_columns: ["notes"] }, [
  row({}),
  row({ row: 3, name: "Lumen Labs", email: null, warnings: ["website: website must be a web link. (left out)"] }),
  row({ row: 4, name: "Revance", status: "skipped", code: "BRAND_EXISTS", message: "A brand of this name is already here.", user_id: 812, slug: null }),
]);

const IMPORTED = result({ dry_run: false, created: 2, skipped: 1, with_warnings: 1, ignored_columns: ["notes"] }, [
  row({ status: "created", user_id: 901 }),
  row({ row: 3, name: "Lumen Labs", email: null, status: "created", user_id: 902, warnings: ["website: website must be a web link. (left out)"] }),
  CHECKED.rows[2],
]);

const renderScreen = () =>
  render(
    <MemoryRouter>
      <ImportBrands />
    </MemoryRouter>,
  );

const pickFile = (container: HTMLElement, name = "brands.csv", type = "application/vnd.ms-excel") =>
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [new File(["name,email\nGlow Co,hello@glow.co\n"], name, { type })] },
  });

/** The form a POST sent: its file and its dry_run. */
const sent = () => {
  const form = vi.mocked(axios.post).mock.lastCall?.[1] as FormData;
  return { file: form.get("csv_file") as File, dryRun: form.get("dry_run") };
};

describe("Import brands", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks the file first, shows the rows that need a look, then imports it and links the new pages", async () => {
    const { container } = renderScreen();
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();

    pickFile(container);
    expect(await screen.findByText("brands.csv")).toBeInTheDocument();

    vi.mocked(axios.post).mockResolvedValue({ data: { data: CHECKED } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("2 brands ready to import; nothing was made yet.")).toBeInTheDocument();
    expect(vi.mocked(axios.post).mock.lastCall?.[0]).toBe(IMPORT);
    // Excel on Windows types a .csv as its own: it goes as text/csv.
    expect(sent().file.type).toBe("text/csv");
    expect(sent().file.name).toBe("brands.csv");
    expect(sent().dryRun).toBe("true");
    expect(screen.getByText(/Columns not read: notes/)).toBeInTheDocument();
    // The rows that need a look first: the one with a warning, and the one already here.
    expect(screen.getByText("website: website must be a web link. (left out)")).toBeInTheDocument();
    expect(screen.getByText("A brand of this name is already here.")).toBeInTheDocument();
    expect(screen.queryByText("Glow Co")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open its page" })).toHaveAttribute("href", "/professionals/pages/812");

    vi.mocked(axios.post).mockResolvedValue({ data: { data: IMPORTED } });
    fireEvent.click(screen.getByRole("button", { name: "Import 2 brands" }));
    fireEvent.click(await screen.findByRole("button", { name: "Import" }));

    expect(await screen.findByText("2 brand pages made.")).toBeInTheDocument();
    expect(sent().dryRun).toBe("false");
    fireEvent.click(screen.getByText("All rows (3)"));
    const links = screen.getAllByRole("link", { name: "Open the new page" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/professionals/pages/901", "/professionals/pages/902"]);
    // Done: the same file isn't imported twice from here.
    expect(screen.getByRole("button", { name: /Import 2 brands/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import another file" })).toBeInTheDocument();
  });

  it("says why a file can't be imported at all", async () => {
    const { container } = renderScreen();
    pickFile(container);
    vi.mocked(axios.post).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { code: "INVALID_CSV", message: "The file has no name column." } },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Check" }));

    const alert = (await screen.findByText("The file can't be imported")).closest<HTMLElement>('[role="alert"]')!;
    expect(within(alert).getByText("The file has no name column.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("turns away a file that isn't a CSV before sending it", async () => {
    const { container } = renderScreen();
    pickFile(container, "brands.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    expect(await screen.findByText(/Pick a .csv file/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
  });

  it("downloads the template through the API", async () => {
    URL.createObjectURL = vi.fn<(object: Blob | MediaSource) => string>(() => "blob:template");
    URL.revokeObjectURL = vi.fn<(url: string) => void>();
    vi.mocked(axios.get).mockResolvedValue({ data: new Blob(["name,email\n"], { type: "text/csv" }) });
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /Download the template/ }));

    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith(`${IMPORT}/template`, { responseType: "blob" }),
    );
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });
});
