import { BrandMark } from "@/components/brand/brand-mark";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Entrar | La Vaca Negra",
};

type SearchParams = Promise<{ redirect?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { redirect: redirectTo } = await searchParams;

  return (
    <main className="min-h-screen w-full grid place-items-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <BrandMark variant="full" width={180} />
          <div className="space-y-2">
            <p className="font-script text-3xl text-primary leading-none">
              El fuego nos une
            </p>
            <h1 className="font-display text-2xl tracking-wide">
              Painel do gestor
            </h1>
            <p className="text-sm text-muted-foreground">
              Entre com suas credenciais administrativas
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/60 p-6 shadow-lg glow-brand">
          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Acesso restrito · Solicite cadastro ao admin geral.
        </p>
      </div>
    </main>
  );
}
