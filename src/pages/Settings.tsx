import { useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link } from "react-router";
import { ROUTES } from "../app/navigation";
import { useAppContext } from "../app/useAppContext";
import { db, validateExportData, type TyporiaDatabase } from "../storage";
import type { DifficultyMode, ExportData, ScreenShake } from "../types/game";

/** 設定画面（docs/spec.md §4.5, §12.4、AC-14, AC-19） */
export interface SettingsProps {
  /** テストで差し替えるためのストレージ。既定はアプリ共有の db */
  database?: Pick<TyporiaDatabase, "exportData" | "importData">;
}

const SCREEN_SHAKE_OPTIONS: { value: ScreenShake; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "weak", label: "弱" },
  { value: "strong", label: "強" },
];

const DIFFICULTY_OPTIONS: { value: DifficultyMode; label: string }[] = [
  { value: "auto", label: "自動調整" },
  { value: "easy", label: "Easy" },
  { value: "normal", label: "Normal" },
  { value: "hard", label: "Hard" },
];

const INVALID_FILE_MESSAGE = "ファイルの形式が正しくありません";
const CONFIRM_MESSAGE = "現在のデータを置き換えます。よろしいですか？";

type ImportState =
  | { kind: "idle" }
  | { kind: "confirm"; data: ExportData }
  | { kind: "error"; message: string }
  | { kind: "done" };

function exportFileName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `typoria-export-${y}${m}${d}.json`;
}

/** File をテキストとして読む。jsdom には File.text() が無いので FileReader を使う */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsText(file);
  });
}

/** JSON をダウンロードさせる。jsdom など createObjectURL が無い環境では何もしない */
function downloadJson(text: string, fileName: string) {
  if (typeof URL.createObjectURL !== "function") return;
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const BUTTON_CLASS =
  "rounded-full px-5 py-2 font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-fever disabled:opacity-50";
const OUTLINE_BUTTON_CLASS = `${BUTTON_CLASS} border border-subtext`;
const PRIMARY_BUTTON_CLASS = `${BUTTON_CLASS} bg-perfect text-bg`;

export function Settings({ database = db }: SettingsProps) {
  const { ready, settings, updateSettings, refresh } = useAppContext();
  const [importState, setImportState] = useState<ImportState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sfxId = useId();
  const sfxVolumeId = useId();
  const bgmId = useId();
  const bgmVolumeId = useId();
  const particlesId = useId();
  const importFileId = useId();

  const handleExport = async () => {
    setBusy(true);
    try {
      const data = await database.exportData();
      downloadJson(JSON.stringify(data, null, 2), exportFileName(new Date()));
    } finally {
      setBusy(false);
    }
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFileText(file));
    } catch {
      setImportState({ kind: "error", message: INVALID_FILE_MESSAGE });
      resetFileInput();
      return;
    }
    const result = validateExportData(parsed);
    if (!result.ok) {
      setImportState({ kind: "error", message: `${INVALID_FILE_MESSAGE}（${result.error}）` });
      resetFileInput();
      return;
    }
    setImportState({ kind: "confirm", data: result.data });
  };

  const handleImportConfirm = async () => {
    if (importState.kind !== "confirm") return;
    setBusy(true);
    try {
      await database.importData(importState.data);
      await refresh();
      setImportState({ kind: "done" });
    } catch (error) {
      const message = error instanceof Error ? error.message : INVALID_FILE_MESSAGE;
      setImportState({ kind: "error", message });
    } finally {
      setBusy(false);
      resetFileInput();
    }
  };

  const handleImportCancel = () => {
    setImportState({ kind: "idle" });
    resetFileInput();
  };

  // 読み込み完了前は同じツリーのまま操作だけ無効化する（DOM の差し替えで見出しが消えないように）
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Link to={ROUTES.home} className="text-subtext underline-offset-4 hover:underline">
          ホームへ戻る
        </Link>
      </header>

      <fieldset disabled={!ready || busy} className="contents">
        <section aria-labelledby="settings-sound" className="flex flex-col gap-4">
          <h2 id="settings-sound" className="text-xl font-bold">
            サウンド
          </h2>
          <SwitchRow
            id={sfxId}
            label="効果音"
            checked={settings.sfxEnabled}
            onChange={(checked) => void updateSettings({ sfxEnabled: checked })}
          />
          <RangeRow
            id={sfxVolumeId}
            label="効果音の音量"
            value={settings.sfxVolume}
            disabled={!settings.sfxEnabled}
            onChange={(value) => void updateSettings({ sfxVolume: value })}
          />
          <SwitchRow
            id={bgmId}
            label="BGM"
            checked={settings.bgmEnabled}
            onChange={(checked) => void updateSettings({ bgmEnabled: checked })}
          />
          <RangeRow
            id={bgmVolumeId}
            label="BGM の音量"
            value={settings.bgmVolume}
            disabled={!settings.bgmEnabled}
            onChange={(value) => void updateSettings({ bgmVolume: value })}
          />
        </section>

        <section aria-labelledby="settings-fx" className="flex flex-col gap-4">
          <h2 id="settings-fx" className="text-xl font-bold">
            演出
          </h2>
          <RadioGroup
            legend="画面揺れ"
            name="screenShake"
            options={SCREEN_SHAKE_OPTIONS}
            value={settings.screenShake}
            onChange={(value) => void updateSettings({ screenShake: value })}
          />
          <SwitchRow
            id={particlesId}
            label="パーティクル"
            checked={settings.particles}
            onChange={(checked) => void updateSettings({ particles: checked })}
          />
        </section>

        <section aria-labelledby="settings-difficulty" className="flex flex-col gap-4">
          <h2 id="settings-difficulty" className="text-xl font-bold">
            難易度
          </h2>
          <RadioGroup
            legend="難易度"
            name="difficultyMode"
            options={DIFFICULTY_OPTIONS}
            value={settings.difficultyMode}
            onChange={(value) => void updateSettings({ difficultyMode: value })}
          />
        </section>

        <section aria-labelledby="settings-data" className="flex flex-col gap-4">
          <h2 id="settings-data" className="text-xl font-bold">
            学習データ
          </h2>
          <p className="text-sm text-subtext">
            学習データは端末内にのみ保存されます。別の端末へ移す場合は JSON
            をエクスポートしてください。
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={busy}
              className={OUTLINE_BUTTON_CLASS}
            >
              JSON をエクスポート
            </button>
            <label
              htmlFor={importFileId}
              className={`${OUTLINE_BUTTON_CLASS} cursor-pointer focus-within:ring-4 focus-within:ring-fever`}
            >
              JSON をインポート
              <input
                ref={fileInputRef}
                id={importFileId}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                disabled={busy}
                onChange={(event) => void handleFileChange(event)}
              />
            </label>
          </div>

          {importState.kind === "confirm" && (
            <div
              role="group"
              aria-label="インポートの確認"
              className="flex flex-col gap-3 rounded-xl border border-perfect/60 bg-bg-gradient/40 p-4"
            >
              <p>{CONFIRM_MESSAGE}</p>
              <p className="text-sm text-subtext">
                セッション {importState.data.sessions.length} 件、累計 XP{" "}
                {importState.data.progress.totalXP}（{importState.data.exportedAt} にエクスポート）
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleImportConfirm()}
                  disabled={busy}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  置き換える
                </button>
                <button
                  type="button"
                  onClick={handleImportCancel}
                  disabled={busy}
                  className={OUTLINE_BUTTON_CLASS}
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
          {importState.kind === "error" && (
            <p role="alert" className="rounded-xl border border-incorrect/60 p-3 text-incorrect">
              {importState.message}
            </p>
          )}
          {importState.kind === "done" && (
            <p role="status" className="rounded-xl border border-correct/60 p-3 text-correct">
              インポートが完了しました
            </p>
          )}
        </section>
      </fieldset>
    </main>
  );
}

interface SwitchRowProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SwitchRow({ id, label, checked, onChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-6 w-6 accent-perfect focus:outline-none focus-visible:ring-4 focus-visible:ring-fever"
      />
    </div>
  );
}

interface RangeRowProps {
  id: string;
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function RangeRow({ id, label, value, disabled, onChange }: RangeRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-40 accent-perfect focus:outline-none focus-visible:ring-4 focus-visible:ring-fever disabled:opacity-50"
        />
        <span className="w-10 text-right text-subtext tabular-nums" aria-hidden="true">
          {value}
        </span>
      </div>
    </div>
  );
}

interface RadioGroupProps<T extends string> {
  legend: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: RadioGroupProps<T>) {
  return (
    <fieldset className="flex flex-wrap items-center gap-4">
      <legend className="mb-2 font-medium">{legend}</legend>
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        return (
          <div key={option.value} className="flex items-center gap-2">
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="h-5 w-5 accent-perfect focus:outline-none focus-visible:ring-4 focus-visible:ring-fever"
            />
            <label htmlFor={id}>{option.label}</label>
          </div>
        );
      })}
    </fieldset>
  );
}
