import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/components/auth-card";
import { PasswordForm } from "@/features/auth/components/password-form";

export const metadata: Metadata = { title: "Nuova password" };

export default function PasswordPage() {
  return (
    <AuthCard>
      <PasswordForm />
    </AuthCard>
  );
}
