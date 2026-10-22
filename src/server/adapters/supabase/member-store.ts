import { okAsync } from "neverthrow";
import type { MemberStore } from "../../core/members/members";
import { run } from "./book-store";
import type { Supabase } from "./client";

const memberColumns = "user_id, email, display_name, role, active, created_at";
const invitationColumns = "email, role, created_at, expires_at";
const settingsColumns = "open_signup, signup_role, language";

// La RLS limita ogni query all'admin; qui c'è solo la traduzione in PostgREST.
export const supabaseMemberStore = (supabase: Supabase): MemberStore => ({
  list: () =>
    run(
      supabase
        .from("members")
        .select(memberColumns)
        .order("created_at", { ascending: true }),
    ),

  update: (userId, patch) =>
    run(
      supabase
        .from("members")
        .update(patch)
        .eq("user_id", userId)
        .select(memberColumns)
        .maybeSingle(),
    ),

  invitations: () =>
    run(
      supabase
        .from("invitations")
        .select(invitationColumns)
        .order("created_at", { ascending: false }),
    ),

  // Reinvitare la stessa email rinnova la scadenza e aggiorna il ruolo.
  invite: ({ email, role }) =>
    run(
      supabase
        .from("invitations")
        .upsert({
          email,
          role,
          created_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + 14 * 24 * 3600 * 1000,
          ).toISOString(),
        })
        .select(invitationColumns)
        .single(),
    ),

  revoke: (email) =>
    run(
      supabase.from("invitations").delete().eq("email", email).select("email"),
    ).andThen(() => okAsync(undefined)),

  settings: () =>
    run(supabase.from("instance_settings").select(settingsColumns).single()),

  updateSettings: (patch, by) =>
    run(
      supabase
        .from("instance_settings")
        .update({ ...patch, updated_by: by })
        .eq("id", true)
        .select(settingsColumns)
        .single(),
    ),
});
