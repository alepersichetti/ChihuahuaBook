// Tipi dello schema `public`, nello stesso formato di `supabase gen types typescript`.
// Dopo ogni migrazione rigenerali con: npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type BookRow = {
  id: string;
  owner_id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  editors: string[];
  translators: string[];
  illustrators: string[];
  publisher: string | null;
  published_year: number | null;
  edition: string | null;
  isbn13: string | null;
  isbn10: string | null;
  pages: number | null;
  format: string | null;
  language: string | null;
  genres: string[];
  series: string | null;
  series_number: number | null;
  summary: string | null;
  cover_path: string | null;
  cover_url: string | null;
  read_status: Database["public"]["Enums"]["read_status"];
  started_reading_on: string | null;
  finished_reading_on: string | null;
  rating: number | null;
  favorite: boolean;
  notes: string | null;
  tags: string[];
  location: string | null;
  condition: string | null;
  signed: boolean;
  purchased_on: string | null;
  purchased_from: string | null;
  purchase_price: number | null;
  estimated_value: number | null;
  currency: string | null;
  source: string | null;
  source_id: string | null;
  extra: Json;
  created_at: string;
  updated_at: string;
  search: unknown;
};

type BookInsert = Partial<Omit<BookRow, "title" | "search">> & {
  title: string;
};

type CollectionRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

type CollectionBookRow = {
  collection_id: string;
  book_id: string;
  owner_id: string;
  added_at: string;
};

type LoanRow = {
  id: string;
  owner_id: string;
  book_id: string;
  borrower: string;
  loaned_on: string;
  due_on: string | null;
  returned_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      books: {
        Row: BookRow;
        Insert: BookInsert;
        Update: Partial<Omit<BookRow, "search">>;
        Relationships: [];
      };
      collections: {
        Row: CollectionRow;
        Insert: Partial<CollectionRow> & { name: string };
        Update: Partial<CollectionRow>;
        Relationships: [];
      };
      collection_books: {
        Row: CollectionBookRow;
        Insert: Partial<CollectionBookRow> & {
          collection_id: string;
          book_id: string;
        };
        Update: Partial<CollectionBookRow>;
        Relationships: [
          {
            foreignKeyName: "collection_books_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_books_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
        ];
      };
      loans: {
        Row: LoanRow;
        Insert: Partial<LoanRow> & { book_id: string; borrower: string };
        Update: Partial<LoanRow>;
        Relationships: [
          {
            foreignKeyName: "loans_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      immutable_unaccent: { Args: { value: string }; Returns: string };
    };
    Enums: {
      read_status: "unread" | "reading" | "read" | "abandoned";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
