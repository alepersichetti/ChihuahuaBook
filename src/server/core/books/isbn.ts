export type Isbn = { isbn13: string; isbn10: string | null };

export function cleanIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

// Somma pesata delle cifre: `weight` riceve la posizione della cifra.
const weightedSum = (digits: string, weight: (index: number) => number): number =>
  [...digits].reduce((sum, char, index) => sum + (char === "X" ? 10 : Number(char)) * weight(index), 0);

export function isValidIsbn10(value: string): boolean {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  return weightedSum(value, (i) => 10 - i) % 11 === 0;
}

export function isValidIsbn13(value: string): boolean {
  if (!/^97[89]\d{10}$/.test(value)) return false;
  return isbn13CheckDigit(value.slice(0, 12)) === value[12];
}

function isbn13CheckDigit(first12: string): string {
  const sum = weightedSum(first12, (i) => (i % 2 === 0 ? 1 : 3));
  return String((10 - (sum % 10)) % 10);
}

function isbn10CheckDigit(first9: string): string {
  const sum = weightedSum(first9, (i) => 10 - i);
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? "X" : String(check);
}

export function isbn10To13(isbn10: string): string {
  const first12 = "978" + isbn10.slice(0, 9);
  return first12 + isbn13CheckDigit(first12);
}

// Solo i codici 978 hanno un equivalente a 10 cifre.
export function isbn13To10(isbn13: string): string | null {
  if (!isbn13.startsWith("978")) return null;
  const first9 = isbn13.slice(3, 12);
  return first9 + isbn10CheckDigit(first9);
}

/** Accetta un ISBN-10 o ISBN-13 con o senza trattini e restituisce entrambe le forme. */
export function parseIsbn(raw: string): Isbn | null {
  const value = cleanIsbn(raw);
  if (isValidIsbn13(value)) {
    return { isbn13: value, isbn10: isbn13To10(value) };
  }
  if (isValidIsbn10(value)) {
    return { isbn13: isbn10To13(value), isbn10: value };
  }
  return null;
}
