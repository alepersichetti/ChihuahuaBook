import { describe, expect, it } from "vitest";
import { parsePediaXml } from "./xml";

describe("parsePediaXml", () => {
  it("trova le schede in un XML a elementi, anche con liste annidate", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <collection>
        <item>
          <title>Good Omens</title>
          <authors><author>Terry Pratchett</author><author>Neil Gaiman</author></authors>
          <collectionID>1</collectionID>
        </item>
        <item><title>Dune</title><author>Frank Herbert</author><collectionID>2</collectionID></item>
      </collection>`;
    const parsed = parsePediaXml(xml)._unsafeUnwrap();
    expect(parsed.format).toBe("xml");
    expect(parsed.records).toEqual([
      { title: ["Good Omens"], authors: ["Terry Pratchett", "Neil Gaiman"], collectionID: ["1"] },
      { title: ["Dune"], author: ["Frank Herbert"], collectionID: ["2"] },
    ]);
  });

  it("legge i campi con il nome in un attributo", () => {
    const xml = `<books><book><field name="Title">Emma</field><field name="Author">Jane Austen</field></book>
      <book><field name="Title">Persuasion</field><field name="Author">Jane Austen</field></book></books>`;
    expect(parsePediaXml(xml)._unsafeUnwrap().records).toEqual([
      { Title: ["Emma"], Author: ["Jane Austen"] },
      { Title: ["Persuasion"], Author: ["Jane Austen"] },
    ]);
  });

  it("legge un plist con un array di dizionari", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <plist version="1.0"><dict><key>Items</key><array>
        <dict><key>title</key><string>Dune</string><key>pages</key><integer>412</integer>
          <key>read</key><true/><key>dateRead</key><date>2020-03-04T00:00:00Z</date></dict>
      </array></dict></plist>`;
    const parsed = parsePediaXml(xml)._unsafeUnwrap();
    expect(parsed.format).toBe("plist");
    expect(parsed.records).toEqual([
      { title: ["Dune"], pages: ["412"], read: ["true"], dateRead: ["2020-03-04T00:00:00.000Z"] },
    ]);
  });

  it("segnala un XML rotto", () => {
    expect(parsePediaXml("<collection><item>").isErr()).toBe(true);
  });
});
