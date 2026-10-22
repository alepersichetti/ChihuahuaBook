import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { PasswordForm } from "@/features/auth/components/password-form";
import { I18nProvider } from "@/features/i18n/i18n-context";
import { getLanguage } from "@/lib/i18n";

async function LocalizedPasswordForm() {
  return (
    <I18nProvider language={await getLanguage()}>
      <PasswordForm />
    </I18nProvider>
  );
}

export default function PasswordPage() {
  return (
    <AuthCard>
      <Suspense>
        <LocalizedPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
