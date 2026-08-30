import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 py-6 sm:items-center sm:py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Фінансова CRM
          </p>
          <CardTitle className="text-2xl">Увійти в Freelance Flow</CardTitle>
          <CardDescription>
            Доступ лише за запрошенням адміністратора. Email і пароль.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
