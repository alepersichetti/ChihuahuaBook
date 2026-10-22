import { Suspense } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { I18nProvider } from "@/features/i18n/i18n-context";
import { getLanguage } from "@/lib/i18n";

async function LocalizedLoginForm() {
  return (
    <I18nProvider language={await getLanguage()}>
      <LoginForm />
    </I18nProvider>
  );
}

export default function LoginPage() {
  return (
    <AuthCard>
      <Suspense>
        <LocalizedLoginForm />
      </Suspense>
    </AuthCard>
  );
}
