export type Isbn = { isbn13: string; isbn10: string | null };

export function cleanIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIsbn10(value: string): boolean {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = value[i] === "X" ? 10 : Number(value[i]);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(value: string): boolean {
  if (!/^97[89]\d{10}$/.test(value)) return false;
  return isbn13CheckDigit(value.slice(0, 12)) === value[12];
}

function isbn13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

function isbn10CheckDigit(first9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(first9[i]) * (10 - i);
  }
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
