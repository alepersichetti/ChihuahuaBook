import { unzip } from "fflate";

// Un file .pedia è una cartella (un "pacchetto" per il Finder) con un XML e le copertine.
// Il browser la riceve come elenco di file, oppure come zip quando la cartella è compressa.

export type BundleFile = { readonly path: string; readonly blob: Blob };

export type Bundle = {
  readonly name: string;
  readonly xml: BundleFile | null;
  readonly images: readonly BundleFile[];
  /** Tutti gli XML trovati, nel caso quello scelto non sia giusto. */
  readonly xmlCandidates: readonly string[];
};

const imageTypes: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  bmp: "image/bmp",
};

export const extensionOf = (path: string) =>
  path.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "";

export const imageTypeOf = (path: string) => imageTypes[extensionOf(path)] ?? null;

// File di sistema del Mac che finiscono negli zip.
const isJunk = (path: string) =>
  /(^|\/)(__MACOSX|\.DS_Store|\.Trashes)(\/|$)/.test(path) ||
  /(^|\/)\._/.test(path);

const depth = (path: string) => path.split("/").length;

const preferredXml = /(^|\/)(info|contents|collection|library|bookpedia|export|data)\.(xml|plist)$/i;

/** Sceglie l'XML con le schede: prima i nomi noti, poi il meno annidato, poi il più grande. */
export const pickXml = (files: readonly BundleFile[]): BundleFile | null =>
  files
    .filter((file) => /\.(xml|plist)$/i.test(file.path))
    .toSorted(
      (a, b) =>
        Number(preferredXml.test(b.path)) - Number(preferredXml.test(a.path)) ||
        depth(a.path) - depth(b.path) ||
        b.blob.size - a.blob.size,
    )[0] ?? null;

const rootName = (paths: readonly string[]) => {
  const first = paths[0]?.split("/") ?? [];
  const shared = first.length > 1 && paths.every((path) => path.split("/")[0] === first[0]);
  return shared ? first[0] : null;
};

/** Mette insieme il bundle a partire dai suoi file, con percorsi relativi alla cartella. */
export const bundleFromFiles = (files: readonly BundleFile[], fallbackName: string): Bundle => {
  const useful = files.filter((file) => !isJunk(file.path) && file.blob.size > 0);
  const xml = pickXml(useful);
  return {
    name: (rootName(useful.map((file) => file.path)) ?? fallbackName).replace(/\.(pedia|bookpedia|zip)$/i, ""),
    xml,
    images: useful.filter((file) => imageTypeOf(file.path) !== null),
    xmlCandidates: useful.filter((file) => /\.(xml|plist)$/i.test(file.path)).map((file) => file.path),
  };
};

const withType = (path: string, data: Uint8Array) =>
  new Blob([data as Uint8Array<ArrayBuffer>], { type: imageTypeOf(path) ?? "" });

/** Apre uno zip nel browser (in un worker, se disponibile). */
export const filesFromZip = (zip: Blob): Promise<BundleFile[]> =>
  zip.arrayBuffer().then(
    (buffer) =>
      new Promise<BundleFile[]>((resolve, reject) =>
        unzip(new Uint8Array(buffer), (error, entries) =>
          error
            ? reject(error)
            : resolve(
                Object.entries(entries)
                  .filter(([path]) => !path.endsWith("/"))
                  .map(([path, data]) => ({ path, blob: withType(path, data) })),
              ),
        ),
      ),
  );

/** File scelti con `<input webkitdirectory>`: il percorso relativo è nel file stesso. */
export const filesFromInput = (files: readonly File[]): BundleFile[] =>
  files.map((file) => ({ path: file.webkitRelativePath || file.name, blob: file }));

// Trascinamento: le cartelle vanno lette ricorsivamente con le API "entry".

const readAllEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
  new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject)).then(
    // readEntries restituisce al massimo 100 voci per volta: si continua finché è vuoto.
    (batch) => (batch.length === 0 ? [] : readAllEntries(reader).then((rest) => [...batch, ...rest])),
  );

const filesFromEntry = (entry: FileSystemEntry, prefix: string): Promise<BundleFile[]> => {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.isFile) {
    return new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)).then(
      (file) => [{ path, blob: file }],
    );
  }
  if (entry.isDirectory) {
    return readAllEntries((entry as FileSystemDirectoryEntry).createReader())
      .then((children) => Promise.all(children.map((child) => filesFromEntry(child, path))))
      .then((nested) => nested.flat());
  }
  return Promise.resolve([]);
};

export const filesFromDrop = (items: DataTransferItemList): Promise<BundleFile[]> =>
  Promise.all(
    Array.from(items)
      .map((item) => item.webkitGetAsEntry())
      .filter((entry): entry is FileSystemEntry => entry !== null)
      .map((entry) => filesFromEntry(entry, "")),
  ).then((nested) => nested.flat());

const isZip = (file: BundleFile) => /\.zip$/i.test(file.path) || file.blob.type === "application/zip";

/**
 * Un XML scelto da solo, fuori dal suo .pedia: non si accetta, perché senza
 * la cartella mancherebbero le copertine.
 */
export const isLooseXml = (files: readonly BundleFile[]): boolean =>
  files.length === 1 && /\.(xml|plist)$/i.test(files[0].path) && !files[0].path.includes("/");

/** Da ciò che l'utente ha scelto (il .pedia come cartella, o il suo zip) al bundle. */
export const readBundle = async (files: readonly BundleFile[]): Promise<Bundle> => {
  const zip = files.length === 1 && isZip(files[0]) ? files[0] : null;
  return zip
    ? bundleFromFiles(await filesFromZip(zip.blob), zip.path.split("/").pop() ?? "Import")
    : bundleFromFiles(files, files[0]?.path.split("/").pop() ?? "Import");
};
