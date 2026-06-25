# Design — Marcação responsável de reservas (anti-fraude + análise do colaborador)

> Status: **✅ IMPLEMENTADO e em produção** (2026-06-25). Desenhado em brainstorming na mesma data.

## Estado da implementação (o que foi entregue)

| Parte | Entregue | Arquivos principais |
|-------|----------|---------------------|
| 1. Banco | colunas `reservas.marked_by`/`marked_at`; tabela `app_settings` (RLS admin) com `marcacao_janela_min`=60 e `marcacao_corte`=2026-06-25 | migração via Management API |
| 2. Server action | `atualizarStatusReserva` valida janela (Manaus UTC−4)/role/trava e grava auditoria via service-role | `reservas/actions.ts` |
| 3. Colaborador | pop-up de confirmação nas 3 ações, lista filtrada pela janela, auto-refresh 60s, msg "expirou"+refresh | `reservas/door-list.tsx`, `auto-refresh.tsx`, `reservas/page.tsx` |
| 4. Admin | sub-aba Pendentes c/ badge, resumo por colaborador, lista a resolver, grupo legado, auditoria por item, alerta clicável na Visão geral | `reservas/page.tsx`, `pendentes-panel.tsx`, `view-tabs.tsx`, `(app)/page.tsx` |
| 5. Gestão | card "Marcação de presença" edita janela + data de corte | `gestao/page.tsx`, `gestao/config-marcacao-form.tsx`, `gestao/actions.ts` |

**Pendência operacional:** ao ativar pra valer, ajustar `marcacao_corte` na Gestão pro dia do go-live (hoje está 2026-06-25, com os seeds como legado).

---


## Resumo do entendimento

- **O quê:** camada de responsabilização na marcação de reservas — o colaborador da porta marca presença no dia, dentro de uma janela de tempo; o admin ganha uma aba **Pendentes** pra supervisionar, resolver o que ficou sem marcar e analisar o colaborador.
- **Por quê:** garantir que as marcações aconteçam, sejam pontuais e verdadeiras, sem poder reescrever depois — e dar ao dono números exatos pra avaliar o colaborador.
- **Pra quem:** colaborador (role `user`) marca; admin / admin_geral supervisiona e corrige.
- **Não-objetivos:** não é um log de auditoria completo (histórico de cada mudança); não trata múltiplos colaboradores com escala de plantão (v1 assume essencialmente 1 colaborador); não blinda contra acesso direto à API (coberto pelo RLS já aplicado + uso só via app).

## Suposições

- Janela padrão **60 min** após o horário, **configurável na Gestão**.
- Escala mínima (1 restaurante, poucos funcionários) → sem preocupação de performance.
- Admin nunca é travado; suas ações também são auditadas (`marked_by` = admin).
- Fuso de cálculo = **America/Manaus (UTC−4)**.
- App ainda em desenvolvimento (dados atuais são seed) → a data de corte é o go-live.

## Decision Log

| # | Decisão | Alternativas | Por quê |
|---|---------|--------------|---------|
| 1 | Colaborador vê hoje + passadas do horário; some ~1h depois (janela) | só hoje / +1 dia de folga | fiel ao tempo real, sem backlog antigo pra ele |
| 2 | Trava modelo **B**: corrige dentro da janela, depois só admin | travar na hora / livre até fim do dia | equilíbrio anti-fraude × usabilidade |
| 3 | **Pop-up de confirmação** nas 3 ações (Chegou/Não veio/Cancelou) | sem confirmação / só nas 2 de presença | evita clique errado, marca intenção |
| 4 | Admin vê pendentes em **sub-aba de Reservas** com badge | item no menu / dentro de Gestão | contexto certo + menu enxuto + sinal de ação |
| 5 | Aba mostra **resumo por colaborador + lista + auditoria por item** | só lista / só números | cobrança + ação num lugar |
| 6 | **Período selecionável + data de corte**; legado neutro | 7d fixo / tudo junto | justo com o colaborador (entra "zerado" no go-live) |
| 7 | Métricas simplificadas: **marcada × não-marcada** | incluir "atrasada" | YAGNI |
| 8 | Enforcement na **server action** (Opção 1) | trigger no banco / híbrido | cobre a ameaça real (UI), simples, fácil manter |
| 9 | Expiração: **servidor barra + mensagem "expirou" (A)** + **auto-refresh leve (B)** | timer por card | verdade no servidor + tela limpa sem complexidade |
| 10 | Atribuição: admin limpou depois = conta como **"não marcada a tempo"** do colaborador **(i)** | conta como marcada | fiel à cobrança |

## Design final

### Dados
- `reservas`: + `marked_by uuid` (FK usuário; null = não marcada) + `marked_at timestamptz`.
- Tabela `app_settings (key text pk, value text)` com:
  - `marcacao_janela_min` (default `60`)
  - `marcacao_corte` (data go-live; antes disso = legado)
- Derivações: *não-marcada* = `status='confirmada'` e data passada; *marcada* = `marked_by not null`; *legado* = `data_reserva < marcacao_corte`.

### Server action (`atualizarStatusReserva`)
1. `assertAuth()` → usuário + role.
2. Carrega a reserva (`data_reserva`, `horario`, `status`, `marked_by`).
3. `deadline = (data_reserva + horario, fuso Manaus) + janela_min` (horário null → 23:59 + janela).
4. Autorização:
   - admin/admin_geral → sempre; grava `marked_by=admin`.
   - colaborador → só se reserva é **de hoje** e `agora ≤ deadline`; corrige livre nesse intervalo; passou → **rejeita** com *"Essa reserva já expirou (fora da janela). Fale com o admin."*
5. Sucesso → grava `marked_by` + `marked_at = agora`.

### Colaborador (modo porta `/reservas`)
- Lista só de hoje, item visível enquanto `agora ≤ deadline`.
- Cards: **Chegou / Não veio / Cancelou** com **pop-up de confirmação**.
- Corrigível dentro da janela; some após (no refresh).
- **Auto-refresh leve** (~1 min) pra limpar expirados sozinho.
- Se clicar num expirado (tela velha): servidor barra → mensagem + refresh.
- Sem card "Pendentes" de dias passados (vira só do admin).

### Admin (sub-aba "Pendentes (n)" em Reservas)
- Seletor de período (7/30/90) → controla o resumo.
- **Resumo por colaborador:** `Marcos — 18 marcadas no prazo · 4 não marcadas a tempo` (não-marcada = admin resolveu OU ainda aberta, pós-corte).
- **Lista das não-marcadas** (pós-corte) pra admin resolver (sem trava), recentes primeiro.
- **Grupo recolhível "Antigas (legado)"** — pré-corte, neutro, não conta.
- **Auditoria por item:** em qualquer lista, reserva marcada mostra `✓ Compareceu · por Marcos · 20:15`.
- Alerta da Visão geral vira clicável → leva pra essa aba.

### Casos de borda
- Fuso Manaus explícito no cálculo do deadline.
- `horario` null → deadline no fim do dia + janela.
- Marcação precoce permitida (dentro da janela).
- Canceladas pelo sistema não entram em pendentes.
- Admin corrige depois → `marked_by=admin`; conta como falha do colaborador no resumo (decisão 10).

## Riscos conhecidos
- Múltiplos colaboradores: o resumo não sabe "quem estava de plantão" — v1 assume 1 colaborador. Revisitar se crescer.
- `marked_by` guarda só o último marcador (sem histórico de mudanças) — suficiente pra v1.
- Auto-refresh leve adiciona um efeito client — manter intervalo alto (~60s) pra não pesar.
