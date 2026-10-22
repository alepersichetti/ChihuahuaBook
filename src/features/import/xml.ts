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

const pad = (value: number) => String(value).padStart(2, "0");

// Bookpedia salva le date a mezzanotte dell'ora locale (es. 2004-06-30T22:00:00Z
// per il 1° luglio in Italia): si leggono nel fuso del browser, che è quello dell'utente.
export const localDateTime = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
  `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const scalarText = (value: PlistValue): string[] =>
  value instanceof Date
    ? [localDateTime(value)]
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

/** Chiave del dizionario esterno, conservata nella scheda: può dare il nome alla copertina. */
export const pediaKeyField = "pediaKey";

type KeyedDict = { readonly key: string | null; readonly dict: PlistDict };

/**
 * L'elenco di schede più lungo dentro il plist, ovunque si trovi: un array di
 * dizionari, oppure (come nei .pedia) un dizionario numero → scheda.
 */
const findDictList = (value: PlistValue): KeyedDict[] => {
  const longest = (lists: KeyedDict[][]) =>
    lists.reduce<KeyedDict[]>((a, b) => (b.length > a.length ? b : a), []);
  if (Array.isArray(value)) {
    return longest([
      value.filter(isDict).map((dict) => ({ key: null, dict })),
      ...value.map(findDictList),
    ]);
  }
  if (isDict(value)) {
    const children = Object.entries(value).flatMap(([key, child]) =>
      isDict(child) ? [{ key, dict: child }] : [],
    );
    const nested = longest(Object.values(value).map(findDictList));
    // Un dizionario di dizionari è un elenco di schede; uno solo è la scheda stessa.
    return children.length > 1 && children.length >= nested.length
      ? children
      : nested.length > 0
        ? nested
        : [{ key: null, dict: value }];
  }
  return [];
};

const recordFromKeyed = ({ key, dict }: KeyedDict): PediaRecord =>
  key === null
    ? recordFromDict(dict)
    : { [pediaKeyField]: [key], ...recordFromDict(dict) };

// Caratteri di controllo che XML 1.0 vieta ma che a volte finiscono nei testi copiati.
const invalidXmlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

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
export const parsePediaXml = (raw: string): Result<ParsedXml, string> => {
  const text = raw.replace(/^\uFEFF/, "").replace(invalidXmlChars, "");
  // Il plist si legge una volta sola: con file da decine di MB conta.
  if (/^\s*(<\?xml[^>]*>\s*)?(<!DOCTYPE plist[^>]*>\s*)?<plist[\s>]/.test(text)) {
    return tryParsePlist(text).map((value) => ({
      format: "plist" as const,
      records: findDictList(value).map(recordFromKeyed),
    }));
  }
  return tryParse(text).andThen(({ document, issues }) => {
    const root = document.documentElement;
    if (!root || issues.length > 0) {
      return err(`XML non valido${issues[0] ? `: ${issues[0]}` : ""}`);
    }
    return ok({
      format: "xml" as const,
      records: findRecordElements(root).map(recordFromElement),
    });
  });
};
