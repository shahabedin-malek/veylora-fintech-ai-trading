import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm, RegisterForm } from "@/components/AuthForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  return (
    <div className="grid cols-2" style={{ maxWidth: 900, margin: "20px auto" }}>
      <h1 className="sr-only">Sign in or create an account</h1>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 26 }}>Sign in</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          Sample account is pre-filled. Admins land in the CRM console.
        </p>
        <LoginForm />
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 26 }}>Create account</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
          You get a simulated wallet automatically. No real funds involved.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
