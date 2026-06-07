import { format, subDays } from "date-fns";
import { FileText, TrendingUp, Users } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";

import { DownloadForm } from "./download-form";

export default async function RelatoriosPage() {
  await requireAdmin();
  const today = format(new Date(), "yyyy-MM-dd");
  const last30 = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const reports = [
    {
      tipo: "reservas",
      titulo: "Reservas",
      icon: FileText,
      descricao:
        "Lista detalhada de todas as reservas no período (cliente, área, status, etc).",
      defaultFrom: last30,
    },
    {
      tipo: "ocupacao",
      titulo: "Ocupação",
      icon: TrendingUp,
      descricao:
        "% de ocupação por área e período (almoço/jantar), com no-shows e cancelamentos.",
      defaultFrom: last30,
    },
    {
      tipo: "clientes",
      titulo: "Clientes",
      icon: Users,
      descricao:
        "Base completa do CRM com histórico de reservas e atividade da Olivia.",
      defaultFrom: null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Exporte em CSV (planilhas) ou PDF (apresentação com identidade da marca)"
      />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.tipo} className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <r.icon className="h-4 w-4 text-primary" /> {r.titulo}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <p className="text-sm text-muted-foreground">{r.descricao}</p>
              <DownloadForm
                tipo={r.tipo}
                defaultFrom={r.defaultFrom}
                defaultTo={today}
              />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-sm">
            <span className="font-medium">PDF inclui:</span>{" "}
            <span className="text-muted-foreground">
              cabeçalho com marca La Vaca Negra (vermelho carmim + tagline
              &ldquo;El fuego nos une&rdquo;), tabela formatada com linhas
              alternadas, paginação e timestamp.
            </span>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
