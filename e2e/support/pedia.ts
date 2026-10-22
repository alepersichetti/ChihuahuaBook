import { zipSync } from "fflate";
import { deflateSync } from "node:zlib";

// Un piccolo export di Bookpedia, compresso come lo comprime il Finder del Mac:
// la cartella .pedia con il plist delle schede e una copertina chiamata con l'UID del libro.

export const pediaName = "Biblioteca e2e";

export const pediaBooks = [
  { uid: "E2E-1", title: "Il giardino dei Finzi-Contini", author: "Giorgio Bassani", isbn: "9788804207788", publisher: "Einaudi" },
  { uid: "E2E-2", title: "Marcovaldo", author: "Italo Calvino", isbn: "", publisher: "Einaudi" },
] as const;

const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");

const plist = () => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
${pediaBooks
  .map(
    (book, index) => `  <key>${index + 1}</key><dict>
    <key>title</key><string>${escape(book.title)}</string>
    <key>author</key><string>${escape(book.author)}</string>
    <key>publisher</key><string>${escape(book.publisher)}</string>
    ${book.isbn ? `<key>isbn</key><string>${book.isbn}</string>` : ""}
    <key>uid</key><string>${book.uid}</string>
  </dict>`,
  )
  .join("\n")}
</dict></plist>`;

// CRC-32 dei blocchi PNG (zlib.crc32 c'è solo da Node 22).
const crcTable = Array.from({ length: 256 }, (_, n) =>
  Array.from({ length: 8 }).reduce<number>((c) => (c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1), n),
);
const crc32 = (data: Buffer) => (data.reduce((c, byte) => crcTable[(c ^ byte) & 0xff] ^ (c >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;

const chunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

/** PNG a tinta unita, abbastanza grande da sembrare una copertina. */
export const solidPng = (width: number, height: number, [r, g, b]: readonly [number, number, number]) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bit, RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

/** Lo zip da scegliere con "Scegli lo zip del .pedia". */
export const pediaZip = () => ({
  name: `${pediaName}.pedia.zip`,
  mimeType: "application/zip",
  buffer: Buffer.from(
    zipSync({
      [`${pediaName}.pedia/info.xml`]: new TextEncoder().encode(plist()),
      [`${pediaName}.pedia/Images/${pediaBooks[0].uid}.png`]: solidPng(60, 90, [180, 60, 40]),
    }),
  ),
});
