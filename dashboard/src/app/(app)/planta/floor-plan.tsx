"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Users,
  Phone,
  Clock,
  StickyNote,
  Plus,
  Unlink,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatHora, formatPhone } from "@/lib/format";

import { NovaReservaDialog } from "../reservas/nova-reserva-dialog";

export interface ReservaCard {
  id: number;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  horario: string;
  qtd_pessoas: number;
  observacoes: string | null;
  periodo: string;
}

export interface Mesa {
  id: number;
  area_codigo: string;
  nome: string;
  capacidade: number;
  shape: "rect" | "circle";
  tipo: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pessoas_reserva?: number;
  reservas?: ReservaCard[];
}

interface FloorPlanProps {
  mesas: Mesa[];
  width: number;
  height: number;
  areaCodigo: string;
  data: string;
  areas: { codigo: string; nome: string; evento_fechado: boolean }[];
  mesasPorArea: Record<string, { id: number; nome: string; capacidade: number }[]>;
}

const groupsKey = (area: string, data: string) => `lvn:groups:${area}:${data}`;
const DRAG_THRESHOLD = 6; // px em coords do viewport

// Gerador de id de grupo no escopo do módulo (mantém a função do componente pura)
let groupIdSeq = 0;
function nextGroupId(): string {
  groupIdSeq += 1;
  return `g-${Date.now().toString(36)}-${groupIdSeq}`;
}

function loadGroupsFromStorage(area: string, data: string): Record<number, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(groupsKey(area, data));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<number, string>;
    }
    return {};
  } catch {
    return {};
  }
}

// Cores
const COLOR_EMPTY_FILL = "hsl(220 14% 92%)";          // cinza claro
const COLOR_EMPTY_STROKE = "hsl(220 10% 70%)";
const COLOR_PARTIAL_FILL = "hsl(45 93% 58%)";         // amarelo
const COLOR_PARTIAL_STROKE = "hsl(38 90% 45%)";
const COLOR_FULL_FILL = "hsl(142 65% 42%)";           // verde
const COLOR_FULL_STROKE = "hsl(142 70% 32%)";
const COLOR_GROUP_HALO = "hsl(10 75% 53% / 0.10)";    // halo coral leve
const COLOR_GROUP_HALO_STROKE = "hsl(10 75% 53% / 0.45)";

type DragState = {
  pointerId: number;
  mesaId: number;
  startClientX: number;
  startClientY: number;
  currentSvgX: number;
  currentSvgY: number;
  dragging: boolean;
  hoverTargetMesaId: number | null;
};

type SelectedGroup = {
  groupKey: string;
  mesaIds: number[];
};

export function FloorPlan({
  mesas,
  width,
  height,
  areaCodigo,
  data,
  areas,
  mesasPorArea,
}: FloorPlanProps) {
  const [groups, setGroups] = useState<Record<number, string>>(() =>
    loadGroupsFromStorage(areaCodigo, data)
  );
  const [selected, setSelected] = useState<SelectedGroup | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Recarrega grupos quando (área, data) muda — sem useEffect, padrão derived-state
  const [loadedKey, setLoadedKey] = useState(`${areaCodigo}:${data}`);
  const wantedKey = `${areaCodigo}:${data}`;
  if (wantedKey !== loadedKey) {
    setLoadedKey(wantedKey);
    setGroups(loadGroupsFromStorage(areaCodigo, data));
    setSelected(null);
  }

  const persistGroups = useCallback(
    (next: Record<number, string>) => {
      setGroups(next);
      try {
        localStorage.setItem(groupsKey(areaCodigo, data), JSON.stringify(next));
      } catch {
        // ignora — quota cheia ou modo privado
      }
    },
    [areaCodigo, data]
  );

  // groupKey por mesa (id de grupo persistido ou "solo-<mesaId>")
  const groupKeyOf = useCallback(
    (mesaId: number) => groups[mesaId] ?? `solo-${mesaId}`,
    [groups]
  );

  // Mapa groupKey → mesas do grupo
  const gruposMap = useMemo(() => {
    const map = new Map<string, Mesa[]>();
    mesas.forEach((m) => {
      const gid = groupKeyOf(m.id);
      const arr = map.get(gid) ?? [];
      arr.push(m);
      map.set(gid, arr);
    });
    return map;
  }, [mesas, groupKeyOf]);

  // Selected group atualizado quando mesas mudam (ex: depois de salvar reserva)
  const selectedGroup = useMemo(() => {
    if (!selected) return null;
    const arr = gruposMap.get(selected.groupKey);
    if (!arr || arr.length === 0) return null;
    return arr;
  }, [selected, gruposMap]);

  // ── totais
  const totalCap = mesas.reduce((s, m) => s + m.capacidade, 0);
  const totalOcup = mesas.reduce((s, m) => s + (m.pessoas_reserva ?? 0), 0);

  // ── helpers de drag ─────────────────────────────────────
  const toSvgCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const transformed = pt.matrixTransform(inv);
    return { x: transformed.x, y: transformed.y };
  }, []);

  const hitTestMesa = useCallback(
    (svgX: number, svgY: number, ignoreId: number): Mesa | null => {
      for (const m of mesas) {
        if (m.id === ignoreId) continue;
        if (
          svgX >= m.x &&
          svgX <= m.x + m.width &&
          svgY >= m.y &&
          svgY <= m.y + m.height
        ) {
          return m;
        }
      }
      return null;
    },
    [mesas]
  );

  const onMesaPointerDown = (m: Mesa, ev: ReactPointerEvent<SVGGElement>) => {
    ev.preventDefault();
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    const { x, y } = toSvgCoords(ev.clientX, ev.clientY);
    setDragState({
      pointerId: ev.pointerId,
      mesaId: m.id,
      startClientX: ev.clientX,
      startClientY: ev.clientY,
      currentSvgX: x,
      currentSvgY: y,
      dragging: false,
      hoverTargetMesaId: null,
    });
  };

  const onMesaPointerMove = (ev: ReactPointerEvent<SVGGElement>) => {
    if (!dragState || dragState.pointerId !== ev.pointerId) return;
    const dx = ev.clientX - dragState.startClientX;
    const dy = ev.clientY - dragState.startClientY;
    const moved = Math.hypot(dx, dy);
    const { x, y } = toSvgCoords(ev.clientX, ev.clientY);

    if (!dragState.dragging && moved < DRAG_THRESHOLD) {
      setDragState({ ...dragState, currentSvgX: x, currentSvgY: y });
      return;
    }

    const target = hitTestMesa(x, y, dragState.mesaId);
    setDragState({
      ...dragState,
      dragging: true,
      currentSvgX: x,
      currentSvgY: y,
      hoverTargetMesaId: target?.id ?? null,
    });
  };

  const onMesaPointerUp = (m: Mesa, ev: ReactPointerEvent<SVGGElement>) => {
    if (!dragState || dragState.pointerId !== ev.pointerId) return;

    if (!dragState.dragging) {
      // tap → seleciona o grupo dessa mesa
      const gid = groupKeyOf(m.id);
      setSelected({
        groupKey: gid,
        mesaIds: (gruposMap.get(gid) ?? []).map((x) => x.id),
      });
      setDragState(null);
      return;
    }

    // drag — solta sobre alguma mesa?
    const targetId = dragState.hoverTargetMesaId;
    if (targetId !== null && targetId !== dragState.mesaId) {
      // Mescla os dois grupos
      const sourceGid = groupKeyOf(dragState.mesaId);
      const targetGid = groupKeyOf(targetId);
      if (sourceGid !== targetGid) {
        // Cria/usa um groupId estável (escolhe o "menor" pra ser determinístico)
        const finalGid =
          sourceGid < targetGid
            ? sourceGid.startsWith("solo-")
              ? nextGroupId()
              : sourceGid
            : targetGid.startsWith("solo-")
            ? nextGroupId()
            : targetGid;
        const next = { ...groups };
        // Membros do grupo source
        mesas.forEach((mm) => {
          if (groupKeyOf(mm.id) === sourceGid || groupKeyOf(mm.id) === targetGid) {
            next[mm.id] = finalGid;
          }
        });
        persistGroups(next);
        setSelected({
          groupKey: finalGid,
          mesaIds: mesas
            .filter((mm) => next[mm.id] === finalGid)
            .map((mm) => mm.id),
        });
      }
    }
    setDragState(null);
  };

  const onMesaPointerCancel = (ev: ReactPointerEvent<SVGGElement>) => {
    if (dragState && dragState.pointerId === ev.pointerId) {
      setDragState(null);
    }
  };

  // ── separar mesa do grupo
  const separarDoGrupo = (mesaId: number) => {
    const next = { ...groups };
    delete next[mesaId];
    // Se sobrou só uma mesa no grupo, ela também vira solo (limpa)
    const oldGid = groups[mesaId];
    if (oldGid) {
      const remaining = mesas.filter(
        (m) => m.id !== mesaId && groups[m.id] === oldGid
      );
      if (remaining.length <= 1) {
        remaining.forEach((m) => delete next[m.id]);
      }
    }
    persistGroups(next);
    setSelected({ groupKey: `solo-${mesaId}`, mesaIds: [mesaId] });
  };

  const dissolverGrupo = (groupKey: string) => {
    const next = { ...groups };
    mesas.forEach((m) => {
      if (groupKeyOf(m.id) === groupKey) delete next[m.id];
    });
    persistGroups(next);
    setSelected(null);
  };

  // ── render de grupos (halo atrás das mesas) ─────────────
  const groupHalos: { gid: string; bbox: { x: number; y: number; w: number; h: number } }[] = [];
  gruposMap.forEach((arr, gid) => {
    if (arr.length < 2) return;
    const minX = Math.min(...arr.map((m) => m.x));
    const minY = Math.min(...arr.map((m) => m.y));
    const maxX = Math.max(...arr.map((m) => m.x + m.width));
    const maxY = Math.max(...arr.map((m) => m.y + m.height));
    groupHalos.push({
      gid,
      bbox: { x: minX - 8, y: minY - 8, w: maxX - minX + 16, h: maxY - minY + 16 },
    });
  });

  // Função: estado de cor por mesa (considera grupo)
  const colorForMesa = (m: Mesa) => {
    const gid = groupKeyOf(m.id);
    const groupMesas = gruposMap.get(gid) ?? [m];
    const cap = groupMesas.reduce((s, x) => s + x.capacidade, 0);
    const ocup = groupMesas.reduce((s, x) => s + (x.pessoas_reserva ?? 0), 0);
    if (cap === 0 || ocup === 0) {
      return { fill: COLOR_EMPTY_FILL, stroke: COLOR_EMPTY_STROKE, text: "hsl(220 25% 25%)" };
    }
    if (ocup >= cap) {
      return { fill: COLOR_FULL_FILL, stroke: COLOR_FULL_STROKE, text: "white" };
    }
    return { fill: COLOR_PARTIAL_FILL, stroke: COLOR_PARTIAL_STROKE, text: "hsl(35 80% 18%)" };
  };

  if (mesas.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma mesa cadastrada nesta área.
        </p>
      </div>
    );
  }

  // ── detail content (compartilhado entre sidebar desktop e sheet mobile)
  const detail = selectedGroup ? (
    <MesaDetail
      mesas={selectedGroup}
      onSeparar={separarDoGrupo}
      onDissolver={() =>
        selected ? dissolverGrupo(selected.groupKey) : undefined
      }
      onCriarReserva={() => setDialogOpen(true)}
      onClose={() => setSelected(null)}
    />
  ) : (
    <p className="text-xs text-muted-foreground text-center py-8">
      Toque em uma mesa para ver detalhes
    </p>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* ── Mapa (SVG) */}
      <div className="flex-1 min-w-0">
        <div
          className="relative w-full overflow-auto rounded-md border border-border bg-muted/20"
          style={{ maxHeight: "min(80vh, 900px)" }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            // mobile: deixa o canvas físico mais largo (rolagem), desktop ocupa tudo
            className="block w-full h-auto"
            style={{
              touchAction: dragState ? "none" : "auto",
              minWidth: `min(${width}px, 100%)`,
            }}
          >
            <defs>
              <pattern
                id={`grid-${areaCodigo}`}
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="0.5"
                  opacity="0.4"
                />
              </pattern>
            </defs>
            <rect width={width} height={height} fill={`url(#grid-${areaCodigo})`} />

            {/* Halos dos grupos */}
            {groupHalos.map((h) => {
              const isSel = selected?.groupKey === h.gid;
              return (
                <rect
                  key={h.gid}
                  x={h.bbox.x}
                  y={h.bbox.y}
                  width={h.bbox.w}
                  height={h.bbox.h}
                  rx="10"
                  fill={COLOR_GROUP_HALO}
                  stroke={isSel ? "hsl(var(--ring))" : COLOR_GROUP_HALO_STROKE}
                  strokeWidth={isSel ? 3 : 2}
                  strokeDasharray={isSel ? undefined : "6 4"}
                />
              );
            })}

            {/* Mesas */}
            {mesas.map((m) => {
              const c = colorForMesa(m);
              const ocup = m.pessoas_reserva ?? 0;
              const gid = groupKeyOf(m.id);
              const isInSelectedGroup = selected?.groupKey === gid;
              const isDragSource = dragState?.mesaId === m.id;
              const isDropTarget =
                dragState?.dragging && dragState.hoverTargetMesaId === m.id;
              const stroke = isDropTarget
                ? "hsl(10 75% 53%)"
                : isInSelectedGroup
                ? "hsl(var(--ring))"
                : c.stroke;
              const strokeWidth = isDropTarget ? 4 : isInSelectedGroup ? 3 : 1.5;

              return (
                <g
                  key={m.id}
                  onPointerDown={(ev) => onMesaPointerDown(m, ev)}
                  onPointerMove={onMesaPointerMove}
                  onPointerUp={(ev) => onMesaPointerUp(m, ev)}
                  onPointerCancel={onMesaPointerCancel}
                  className="cursor-pointer"
                  style={{
                    opacity: isDragSource && dragState?.dragging ? 0.5 : 1,
                    touchAction: "none",
                  }}
                >
                  {m.shape === "circle" ? (
                    <circle
                      cx={m.x + m.width / 2}
                      cy={m.y + m.height / 2}
                      r={Math.min(m.width, m.height) / 2}
                      fill={c.fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                  ) : (
                    <rect
                      x={m.x}
                      y={m.y}
                      width={m.width}
                      height={m.height}
                      rx="6"
                      fill={c.fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                  )}
                  <text
                    x={m.x + m.width / 2}
                    y={m.y + m.height / 2 - 5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-bold select-none pointer-events-none"
                    fontSize="14"
                    fill={c.text}
                  >
                    {m.nome}
                  </text>
                  <text
                    x={m.x + m.width / 2}
                    y={m.y + m.height / 2 + 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="select-none pointer-events-none tabular-nums"
                    fontSize="11"
                    fill={c.text}
                    fillOpacity={0.85}
                  >
                    {ocup}/{m.capacidade}
                  </text>
                </g>
              );
            })}

            {/* Ghost de drag */}
            {dragState?.dragging && (() => {
              const src = mesas.find((m) => m.id === dragState.mesaId);
              if (!src) return null;
              const offsetX = dragState.currentSvgX - (src.x + src.width / 2);
              const offsetY = dragState.currentSvgY - (src.y + src.height / 2);
              return (
                <g style={{ pointerEvents: "none" }} opacity={0.85}>
                  <rect
                    x={src.x + offsetX}
                    y={src.y + offsetY}
                    width={src.width}
                    height={src.height}
                    rx="6"
                    fill="hsl(10 75% 53% / 0.20)"
                    stroke="hsl(10 75% 53%)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                  />
                  <text
                    x={src.x + offsetX + src.width / 2}
                    y={src.y + offsetY + src.height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="13"
                    fontWeight="bold"
                    fill="hsl(10 75% 30%)"
                  >
                    {src.nome}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Legenda */}
        <div className="mt-3 flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm border"
              style={{ background: COLOR_EMPTY_FILL, borderColor: COLOR_EMPTY_STROKE }}
            />
            Vazia
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: COLOR_PARTIAL_FILL }} />
            Parcial
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: COLOR_FULL_FILL }} />
            Cheia
          </span>
          <span className="hidden sm:inline text-muted-foreground/70">
            · arraste uma mesa sobre outra para unir
          </span>
          <span className="ml-auto font-mono">
            {totalOcup} / {totalCap} lugares
          </span>
        </div>
      </div>

      {/* ── Painel lateral (desktop) */}
      <div
        className={cn(
          "hidden lg:block w-full lg:w-80 shrink-0 rounded-md border border-border bg-card p-4 transition-opacity",
          selectedGroup ? "opacity-100" : "opacity-60"
        )}
      >
        {detail}
      </div>

      {/* ── Bottom sheet (mobile) */}
      {selectedGroup && (
        <div
          className="lg:hidden fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-auto rounded-t-xl border-t border-border bg-card p-4 shadow-2xl"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {detail}
        </div>
      )}

      {/* ── Dialog Nova Reserva (controlado) */}
      {selectedGroup && (
        <NovaReservaDialog
          areas={areas}
          mesasPorArea={mesasPorArea}
          defaultData={data}
          defaultAreaCodigo={areaCodigo}
          defaultMesaIds={selectedGroup.map((m) => m.id)}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          hideTrigger
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
interface MesaDetailProps {
  mesas: Mesa[];
  onSeparar: (mesaId: number) => void;
  onDissolver: () => void;
  onCriarReserva: () => void;
  onClose: () => void;
}

function MesaDetail({
  mesas,
  onSeparar,
  onDissolver,
  onCriarReserva,
  onClose,
}: MesaDetailProps) {
  const isGroup = mesas.length > 1;
  const cap = mesas.reduce((s, m) => s + m.capacidade, 0);
  const ocup = mesas.reduce((s, m) => s + (m.pessoas_reserva ?? 0), 0);

  // Reservas agregadas, ordenadas por horário
  const reservas: (ReservaCard & { mesaNome: string; mesaId: number })[] = [];
  mesas.forEach((m) => {
    (m.reservas ?? []).forEach((r) => {
      reservas.push({ ...r, mesaNome: m.nome, mesaId: m.id });
    });
  });
  reservas.sort((a, b) => a.horario.localeCompare(b.horario));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {isGroup ? "Grupo de mesas" : "Mesa"}
          </p>
          <p className="font-display text-2xl tracking-wide truncate">
            {mesas.map((m) => m.nome).join(" + ")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mesas[0]?.tipo}
            {" · "}
            <span className="tabular-nums">
              {ocup}/{cap} lugares
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -mr-1"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        {reservas.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nenhuma reserva nesta {isGroup ? "junção" : "mesa"} no período.
          </p>
        ) : (
          reservas.map((r) => (
            <div
              key={`${r.id}-${r.mesaId}`}
              className="rounded-md border border-border bg-background/40 p-2.5 space-y-1"
            >
              <p className="text-sm font-medium leading-tight">
                {r.cliente_nome}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatHora(r.horario)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {r.qtd_pessoas}
                </span>
                {r.cliente_telefone && (
                  <a
                    href={`tel:${r.cliente_telefone.replace(/\D/g, "")}`}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <Phone className="h-3 w-3" />
                    {formatPhone(r.cliente_telefone)}
                  </a>
                )}
                {isGroup && (
                  <span className="font-mono text-[10px] text-primary/80">
                    em {r.mesaNome}
                  </span>
                )}
              </div>
              {r.observacoes && (
                <p className="flex items-start gap-1 text-xs text-muted-foreground italic">
                  <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                  {r.observacoes}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <Button
          type="button"
          size="sm"
          onClick={onCriarReserva}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova reserva {isGroup ? "neste grupo" : "nesta mesa"}
        </Button>
        {isGroup && (
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDissolver}
              className="flex-1"
            >
              <Unlink className="h-3.5 w-3.5" />
              Desfazer união
            </Button>
            {mesas.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSeparar(mesas[mesas.length - 1].id)}
              >
                Separar última
              </Button>
            )}
          </div>
        )}
        {isGroup && (
          <p className="text-[10px] text-muted-foreground">
            ⓘ União é salva neste dispositivo, por dia/área.
          </p>
        )}
      </div>
    </div>
  );
}
