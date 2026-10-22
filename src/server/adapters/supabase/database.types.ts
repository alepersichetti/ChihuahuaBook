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
  created_by: string | null;
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
  import_hash: string | null;
  created_at: string;
  updated_at: string;
  search: unknown;
};

type BookInsert = Partial<Omit<BookRow, "title" | "search">> & {
  title: string;
};

type CollectionRow = {
  id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

type CollectionBookRow = {
  collection_id: string;
  book_id: string;
  added_at: string;
};

type LoanRow = {
  id: string;
  created_by: string | null;
  book_id: string;
  borrower: string;
  loaned_on: string;
  due_on: string | null;
  returned_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AppRole = "reader" | "librarian" | "admin";

type MemberRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type InvitationRow = {
  email: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
};

type InstanceSettingsRow = {
  id: boolean;
  open_signup: boolean;
  language: "it" | "en";
  updated_at: string;
  updated_by: string | null;
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
      members: {
        Row: MemberRow;
        Insert: Partial<MemberRow> & { user_id: string; email: string };
        Update: Partial<Pick<MemberRow, "display_name" | "role" | "active">>;
        Relationships: [];
      };
      invitations: {
        Row: InvitationRow;
        Insert: Partial<InvitationRow> & { email: string };
        Update: Partial<InvitationRow>;
        Relationships: [];
      };
      instance_settings: {
        Row: InstanceSettingsRow;
        Insert: Partial<InstanceSettingsRow>;
        Update: Partial<
          Pick<InstanceSettingsRow, "open_signup" | "language" | "updated_by">
        >;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      immutable_unaccent: { Args: { value: string }; Returns: string };
      member_role: { Args: Record<string, never>; Returns: AppRole | null };
      has_role: { Args: { required: AppRole }; Returns: boolean };
      instance_language: { Args: Record<string, never>; Returns: "it" | "en" };
      signup_mode: {
        Args: Record<string, never>;
        Returns: "first_admin" | "open" | "invite_only";
      };
    };
    Enums: {
      read_status: "unread" | "reading" | "read" | "abandoned";
      app_role: AppRole;
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
