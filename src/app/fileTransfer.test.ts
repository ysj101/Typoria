import { afterEach, describe, expect, it, vi } from "vitest";
import { needsExplicitFileSave, shareOrDownloadFile, triggerFileDownload } from "./fileTransfer";

describe("needsExplicitFileSave", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is true for iOS Chrome", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1",
    );
    expect(needsExplicitFileSave()).toBe(true);
  });

  it("is false for desktop Chrome", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    );
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
    expect(needsExplicitFileSave()).toBe(false);
  });
});

describe("triggerFileDownload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts a download from an anchor click", () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:typoria");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let download = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function mockClick(
      this: HTMLAnchorElement,
    ) {
      download = this.download;
    });
    triggerFileDownload(
      new Blob(["{}"], { type: "application/json" }),
      "typoria-export-20261013.json",
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(download).toBe("typoria-export-20261013.json");
  });
});

describe("shareOrDownloadFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shares a prepared file from the user gesture", async () => {
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share, canShare: () => true });
    const file = new File(["{}"], "typoria-export.json", { type: "application/json" });
    await expect(shareOrDownloadFile(file)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], title: file.name });
  });

  it("falls back to download when share is cancelled by a non-abort error", async () => {
    Object.assign(navigator, {
      canShare: () => true,
      share: vi.fn(async () => {
        throw new DOMException("nope", "NotAllowedError");
      }),
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:typoria");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const file = new File(["{}"], "typoria-export.json", { type: "application/json" });
    await expect(shareOrDownloadFile(file)).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalled();
  });
});
