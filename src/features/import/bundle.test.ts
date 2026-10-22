import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { bundleFromFiles, isLooseXml, readBundle } from "./bundle";

const file = (path: string, content = "x") => ({ path, blob: new Blob([content]) });

describe("bundleFromFiles", () => {
  it("trova XML e copertine e ignora i file di sistema del Mac", () => {
    const bundle = bundleFromFiles(
      [
        file("Libri.pedia/Info.xml", "<a/>"),
        file("Libri.pedia/Covers/1.jpg"),
        file("Libri.pedia/.DS_Store"),
        file("__MACOSX/Libri.pedia/._Info.xml"),
      ],
      "fallback",
    );
    expect(bundle.name).toBe("Libri");
    expect(bundle.xml?.path).toBe("Libri.pedia/Info.xml");
    expect(bundle.images.map((image) => image.path)).toEqual(["Libri.pedia/Covers/1.jpg"]);
  });
});

describe("readBundle", () => {
  it("apre uno zip e ne legge i file", async () => {
    const zip = zipSync({
      "Libri.pedia/Info.xml": new TextEncoder().encode("<collection/>"),
      "Libri.pedia/Covers/1.jpg": new Uint8Array([255, 216, 255]),
    });
    const bundle = await readBundle([{ path: "Libri.pedia.zip", blob: new Blob([zip]) }]);
    expect(await bundle.xml?.blob.text()).toBe("<collection/>");
    expect(bundle.images[0].blob.type).toBe("image/jpeg");
  });
});

describe("isLooseXml", () => {
  it("riconosce un XML scelto da solo, fuori dal suo .pedia", () => {
    expect(isLooseXml([file("Info.xml")])).toBe(true);
    expect(isLooseXml([file("Libri.pedia/Info.xml")])).toBe(false);
    expect(isLooseXml([file("Libri.pedia.zip")])).toBe(false);
  });
});
