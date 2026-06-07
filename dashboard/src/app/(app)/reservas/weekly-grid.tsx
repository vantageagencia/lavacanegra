import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";

interface Reserva {
  data_reserva: string;
  periodo: string;
  qtd_pessoas: number;
}

interface WeeklyGridProps {
  weekRef: Date;
  reservas: Reserva[];
}

export function WeeklyGrid({ weekRef, reservas }: WeeklyGridProps) {
  const start = startOfWeek(weekRef, { weekStartsOn: 1 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const slot = (dia: Date, periodo: "almoco" | "jantar") => {
    const filtered = reservas.filter(
      (r) => r.periodo === periodo && isSameDay(parseISO(r.data_reserva), dia)
    );
    return {
      reservas: filtered.length,
      pessoas: filtered.reduce((s, r) => s + (r.qtd_pessoas ?? 0), 0),
    };
  };

  const intensity = (n: number) => {
    if (n === 0) return "bg-muted/30";
    if (n < 10) return "bg-primary/20";
    if (n < 25) return "bg-primary/45";
    if (n < 50) return "bg-primary/65";
    return "bg-primary";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="px-2 py-1 text-left font-normal">Período</th>
            {dias.map((d) => (
              <th key={d.toISOString()} className="px-2 py-1 text-center font-normal">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="uppercase">{format(d, "EEE", { locale: ptBR })}</span>
                  <span className="font-display text-base text-foreground">
                    {format(d, "dd")}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["almoco", "jantar"] as const).map((periodo) => (
            <tr key={periodo}>
              <td className="px-2 py-1 text-muted-foreground uppercase">
                {periodo === "almoco" ? "Almoço" : "Jantar"}
              </td>
              {dias.map((d) => {
                const { reservas: nRes, pessoas: nPess } = slot(d, periodo);
                return (
                  <td key={d.toISOString()} className="p-0.5">
                    <div
                      className={cn(
                        "h-12 rounded-md flex flex-col items-center justify-center leading-tight text-foreground/90",
                        intensity(nPess)
                      )}
                    >
                      {nRes > 0 ? (
                        <>
                          <span className="font-mono text-sm font-semibold">
                            {nRes}
                            <span className="font-normal text-[10px] text-foreground/70">
                              {" "}res
                            </span>
                          </span>
                          <span className="font-mono text-[10px] text-foreground/70">
                            {nPess}p
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
