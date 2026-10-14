import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AppProvider } from "../app/AppContext";
import { createMemoryStorage } from "../app/storage";
import { ImportError } from "../storage/database";
import { DEFAULT_PROGRESS, DEFAULT_SETTINGS, EXPORT_VERSION, type ExportData } from "../types/game";
import { Settings } from "./Settings";

function validExport(): ExportData {
  return {
    version: EXPORT_VERSION,
    exportedAt: "2026-10-13T00:00:00.000Z",
    progress: { ...DEFAULT_PROGRESS, totalXP: 99 },
    sessions: [],
    questionStats: [],
    settings: DEFAULT_SETTINGS,
    termProgress: [],
  };
}

function makeDatabase() {
  return {
    exportData: vi.fn(async (): Promise<ExportData> => validExport()),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    importData: vi.fn(async (_json: unknown) => {}),
  };
}

function setup(database = makeDatabase()) {
  const storage = createMemoryStorage();
  render(
    <AppProvider storage={storage}>
      <MemoryRouter>
        <Settings database={database} />
      </MemoryRouter>
    </AppProvider>,
  );
  return { storage, database };
}

async function waitReady() {
  await screen.findByRole("switch", { name: "効果音" });
}

function jsonFile(content: string, name = "data.json") {
  return new File([content], name, { type: "application/json" });
}

const CONFIRM_TEXT = "現在のデータを置き換えます。よろしいですか？";

describe("Settings page (§4.5)", () => {
  it("shows the default values", async () => {
    setup();
    await waitReady();
    expect(screen.getByRole("switch", { name: "効果音" })).toBeChecked();
    expect(screen.getByRole("slider", { name: "効果音の音量" })).toHaveValue("70");
    expect(screen.getByRole("switch", { name: "BGM" })).toBeChecked();
    expect(screen.getByRole("slider", { name: "BGM の音量" })).toHaveValue("40");
    expect(screen.getByRole("radio", { name: "弱" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "パーティクル" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "自動調整" })).toBeChecked();
  });

  it("keeps every patch when settings writes overlap", async () => {
    const memory = createMemoryStorage();
    let releaseFirst: () => void = () => {};
    const firstWrite = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let writes = 0;
    const storage = {
      ...memory,
      async putSettings(next: Parameters<typeof memory.putSettings>[0]) {
        writes += 1;
        if (writes === 1) await firstWrite;
        await memory.putSettings(next);
      },
    };
    render(
      <AppProvider storage={storage}>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </AppProvider>,
    );
    await waitReady();
    await userEvent.click(screen.getByRole("switch", { name: "効果音" }));
    await userEvent.click(screen.getByRole("switch", { name: "BGM" }));
    releaseFirst();
    await waitFor(async () => {
      const saved = await memory.getSettings();
      expect(saved.sfxEnabled).toBe(false);
      expect(saved.bgmEnabled).toBe(false);
    });
  });

  it("persists turning sound effects off", async () => {
    const { storage } = setup();
    await waitReady();
    await userEvent.click(screen.getByRole("switch", { name: "効果音" }));
    expect(screen.getByRole("switch", { name: "効果音" })).not.toBeChecked();
    await waitFor(async () => expect((await storage.getSettings()).sfxEnabled).toBe(false));
  });

  it("persists volume changes", async () => {
    const { storage } = setup();
    await waitReady();
    fireEvent.change(screen.getByRole("slider", { name: "BGM の音量" }), {
      target: { value: "15" },
    });
    await waitFor(async () => expect((await storage.getSettings()).bgmVolume).toBe(15));
  });

  it("persists difficulty and screen shake changes", async () => {
    const { storage } = setup();
    await waitReady();
    await userEvent.click(screen.getByRole("radio", { name: "Hard" }));
    await userEvent.click(screen.getByRole("radio", { name: "強" }));
    await waitFor(async () => {
      const s = await storage.getSettings();
      expect(s.difficultyMode).toBe("hard");
      expect(s.screenShake).toBe("strong");
    });
  });

  it("calls exportData when exporting", async () => {
    const { database } = setup();
    await waitReady();
    await userEvent.click(screen.getByRole("button", { name: "JSON をエクスポート" }));
    await waitFor(() => expect(database.exportData).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "ファイルを保存" })).not.toBeInTheDocument();
  });

  it("offers a follow-up save button on iOS Chrome", async () => {
    const ua = vi
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1",
      );
    try {
      const { database } = setup();
      await waitReady();
      await userEvent.click(screen.getByRole("button", { name: "JSON をエクスポート" }));
      expect(await screen.findByRole("button", { name: "ファイルを保存" })).toBeInTheDocument();
      expect(database.exportData).toHaveBeenCalledTimes(1);
    } finally {
      ua.mockRestore();
    }
  });

  it("shows an error for an invalid import file", async () => {
    const { database } = setup();
    await waitReady();
    await userEvent.upload(
      screen.getByLabelText("JSON をインポート"),
      jsonFile('{"version": 999}'),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("ファイルの形式が正しくありません");
    expect(database.importData).not.toHaveBeenCalled();
  });

  it("shows an error for a non-JSON file", async () => {
    setup();
    await waitReady();
    await userEvent.upload(screen.getByLabelText("JSON をインポート"), jsonFile("not json"));
    expect(await screen.findByRole("alert")).toHaveTextContent("ファイルの形式が正しくありません");
  });

  it("asks for confirmation then imports a valid file", async () => {
    const { database } = setup();
    await waitReady();
    await userEvent.upload(
      screen.getByLabelText("JSON をインポート"),
      jsonFile(JSON.stringify(validExport())),
    );
    expect(await screen.findByText(CONFIRM_TEXT)).toBeInTheDocument();
    expect(database.importData).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "置き換える" }));
    await waitFor(() => expect(database.importData).toHaveBeenCalledTimes(1));
    expect(database.importData).toHaveBeenCalledWith(validExport());
    expect(await screen.findByRole("status")).toHaveTextContent("インポートが完了しました");
  });

  it("can cancel the import confirmation", async () => {
    const { database } = setup();
    await waitReady();
    await userEvent.upload(
      screen.getByLabelText("JSON をインポート"),
      jsonFile(JSON.stringify(validExport())),
    );
    await userEvent.click(await screen.findByRole("button", { name: "キャンセル" }));
    expect(screen.queryByText(CONFIRM_TEXT)).not.toBeInTheDocument();
    expect(database.importData).not.toHaveBeenCalled();
  });

  it("shows an error when importData rejects", async () => {
    const database = makeDatabase();
    database.importData.mockRejectedValueOnce(new ImportError("壊れています"));
    setup(database);
    await waitReady();
    await userEvent.upload(
      screen.getByLabelText("JSON をインポート"),
      jsonFile(JSON.stringify(validExport())),
    );
    await userEvent.click(await screen.findByRole("button", { name: "置き換える" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("壊れています");
  });
});
