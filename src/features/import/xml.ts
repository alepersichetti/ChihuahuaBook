import { DOMParser, type Element, type Node } from "@xmldom/xmldom";
import { err, ok, Result } from "neverthrow";
import { parse as parsePlist, type PlistValue } from "plist";
import type { PediaRecord } from "@/server/core/books/pedia";

// Dall'XML del bundle .pedia alle schede grezze (campo → valori).
// Accetta sia un plist di Apple sia un XML "a elementi" come quello che
// Bookpedia scrive quando esporta: il formato esatto non è documentato.

export type ParsedXml = {
  readonly format: "plist" | "xml";
  readonly records: readonly PediaRecord[];
};

const elementNode = 1;

const elements = (node: Node): Element[] =>
  Array.from(node.childNodes).filter(
    (child): child is Element => child.nodeType === elementNode,
  );

const textOf = (node: Node) => (node.textContent ?? "").trim();

const leafTexts = (element: Element): string[] => {
  const children = elements(element);
  return children.length === 0
    ? [textOf(element)]
    : children.flatMap(leafTexts);
};

const descendants = (element: Element): Element[] =>
  elements(element).flatMap((child) => [child, ...descendants(child)]);

const recordTagHints = new Set(["item", "book", "entry", "record", "row"]);

// Una scheda è un elemento con molti campi diversi che si ripete molte volte.
const findRecordElements = (root: Element): Element[] => {
  const candidates = descendants(root).filter(
    (element) => elements(element).length >= 2,
  );
  const byTag = Map.groupBy(candidates, (element) => element.tagName);
  const score = (tag: string, list: Element[]) => {
    const fieldNames = new Set(
      list.flatMap((element) => elements(element).map((child) => child.tagName)),
    );
    const hint = recordTagHints.has(tag.toLowerCase()) ? 2 : 1;
    return list.length * fieldNames.size * hint;
  };
  const best = [...byTag.entries()].reduce<[string, Element[]] | null>(
    (top, entry) =>
      !top || score(...entry) > score(...top) ? entry : top,
    null,
  );
  // Un file con un libro solo: la radice stessa è la scheda.
  return best ? best[1] : elements(root).length >= 2 ? [root] : [];
};

const nameAttributes = ["name", "key", "id", "field", "label"];

// <field name="Title">Dune</field> → la chiave è nell'attributo.
const keyOf = (element: Element) =>
  nameAttributes
    .map((attribute) => element.getAttribute(attribute))
    .find((value): value is string => !!value) ?? element.tagName;

const recordFromElement = (element: Element): PediaRecord => {
  const children = elements(element);
  const sameTag = children.every((child) => child.tagName === children[0]?.tagName);
  const keyed = sameTag && children.length > 1;
  const fromAttributes = Array.from(element.attributes).map(
    (attribute) => [attribute.name, [attribute.value]] as const,
  );
  const fromChildren = children.map(
    (child) => [keyed ? keyOf(child) : child.tagName, leafTexts(child)] as const,
  );
  return [...fromAttributes, ...fromChildren].reduce<Record<string, string[]>>(
    (record, [key, values]) => ({
      ...record,
      [key]: [...(record[key] ?? []), ...values.filter(Boolean)],
    }),
    {},
  );
};

// Plist ------------------------------------------------------------------------

type PlistDict = { readonly [key: string]: PlistValue };

const isDict = (value: PlistValue): value is PlistDict =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof Uint8Array) &&
  !ArrayBuffer.isView(value);

const scalarText = (value: PlistValue): string[] =>
  value instanceof Date
    ? [value.toISOString()]
    : Array.isArray(value)
      ? value.flatMap(scalarText)
      : isDict(value)
        ? [JSON.stringify(value)]
        : typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ? [String(value)]
          : [];

const recordFromDict = (dict: PlistDict): PediaRecord =>
  Object.fromEntries(
    Object.entries(dict).map(([key, value]) => [key, scalarText(value)]),
  );

/** L'elenco di schede più lungo dentro il plist, ovunque si trovi. */
const findDictList = (value: PlistValue): PlistDict[] => {
  if (Array.isArray(value)) {
    const dicts = value.filter(isDict);
    const nested = value.map(findDictList);
    return [dicts, ...nested].reduce((a, b) => (b.length > a.length ? b : a));
  }
  if (isDict(value)) {
    const nested = Object.values(value).map(findDictList);
    const longest = nested.reduce<PlistDict[]>(
      (a, b) => (b.length > a.length ? b : a),
      [],
    );
    return longest.length > 0 ? longest : [value];
  }
  return [];
};

const tryParse = Result.fromThrowable(
  (text: string) => {
    const issues: string[] = [];
    const document = new DOMParser({
      onError: (level, message) => {
        if (level !== "warning") issues.push(message);
      },
    }).parseFromString(text, "text/xml");
    return { document, issues };
  },
  (cause) => (cause instanceof Error ? cause.message : String(cause)),
);

const tryParsePlist = Result.fromThrowable(parsePlist, (cause) =>
  cause instanceof Error ? cause.message : String(cause),
);

/** Legge il testo XML del bundle. L'errore è un messaggio da mostrare all'utente. */
export const parsePediaXml = (text: string): Result<ParsedXml, string> =>
  tryParse(text.replace(/^﻿/, "")).andThen(({ document, issues }) => {
    const root = document.documentElement;
    if (!root || issues.length > 0) {
      return err(`XML non valido${issues[0] ? `: ${issues[0]}` : ""}`);
    }
    if (root.tagName === "plist") {
      return tryParsePlist(text).map((value) => ({
        format: "plist" as const,
        records: findDictList(value).map(recordFromDict),
      }));
    }
    return ok({
      format: "xml" as const,
      records: findRecordElements(root).map(recordFromElement),
    });
  });
