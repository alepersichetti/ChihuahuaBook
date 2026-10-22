import type { Language } from "../languages";
import { en } from "./en";
import { it, type Messages } from "./it";

export type { Messages };

export const messages: Readonly<Record<Language, Messages>> = { it, en };
