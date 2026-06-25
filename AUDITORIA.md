# Auditoria — Site La Vaca Negra

> Landing page "link na bio" (HTML + CSS estático).
> Data: 2026-06-07 · Severidade: 🔴 crítico · 🟡 médio · 🟢 leve

**Resumo:** a página funciona, mas carrega **5,5 MB de imagens**, tem SEO/Open Graph praticamente ausentes e **2 links que parecem errados** (Instagram e um WhatsApp) custando conversão hoje.

**Maiores ganhos:**
- Etapa 1 (links errados) → conversão imediata, corrigir hoje.
- Etapa 3 (performance) → dá pra ir de **5,5 MB → ~800 KB** matando duplicatas + WebP.
- Etapa 2 (SEO/OG) → o link "sem foto" no WhatsApp é o que mais dói pra um restaurante.

---

## Etapa 1 — Negócio & Links (🔴 revisar JÁ)

Não são bugs de código, é dinheiro vazando:

| # | Achado | Sev. | Local |
|---|--------|------|-------|
| 1.1 | **Instagram aponta pra `@michelbrasildecor`** (conta de decoração) — não é o Insta do restaurante | 🔴 | `index.html:115` |
| 1.2 | **WhatsApp do topo e banner 1 = `55 75 81913891`** (DDD **75 = Bahia**). Os outros banners usam `55 92...` (Manaus). Provável erro | 🔴 | `index.html:116,123,132` |
| 1.3 | 3 números de WhatsApp diferentes na página (75…, 92984120110, 92985652606) — confirmar se é proposital | 🟡 | `index.html` |

**Ação:** confirmar com o cliente o Instagram e o WhatsApp corretos antes de corrigir.

---

## Etapa 2 — SEO (🔴 página quase invisível pro Google)

| # | Achado | Sev. |
|---|--------|------|
| 2.1 | Sem `<meta name="description">` | 🔴 |
| 2.2 | Sem **Open Graph** (`og:title`, `og:image`, `og:description`) → link compartilhado no WhatsApp/Insta aparece **sem foto e sem descrição** | 🔴 |
| 2.3 | Sem **Schema.org `Restaurant`** (endereço, horário, telefone) → perde rich results / Google local | 🟡 |
| 2.4 | `<title>` é só "LA VACA NEGRA" — sem keywords (cortes argentinos / hambúrguer / Manaus / delivery) | 🟡 |
| 2.5 | Sem `robots.txt`, `sitemap.xml`, `canonical` | 🟢 |

---

## Etapa 3 — Performance (🔴 5,5 MB é pesado demais)

| # | Achado | Sev. |
|---|--------|------|
| 3.1 | **Banners desktop e mobile são arquivos DUPLICADOS idênticos** (`banner.png`==`banner1.png`, `banner2.png`==`banner22.png`…). `display:none` **não impede o download** → o navegador baixa as DUAS versões | 🔴 |
| 3.2 | Banners em **PNG** (~385 KB cada) sendo fotos/arte → em **WebP** cairiam pra ~40–60 KB | 🔴 |
| 3.3 | **Loader fixo de 2,5 s** mesmo com a página já pronta → segura o usuário longe dos CTAs | 🔴 (CRO) |
| 3.4 | Imagens sem `loading="lazy"` | 🟡 |
| 3.5 | `<img>` sem `width`/`height` → layout shift (CLS ruim no Core Web Vitals) | 🟡 |
| 3.6 | Sem `<link rel="preconnect">` pro Google Fonts | 🟢 |

**Peso atual das imagens (5,5 MB total):**
- `topo2.jpg` 541 KB · `banner2/22.png` 385 KB cada · `banner3/33.png` 344 KB cada · `topo1.jpg` 324 KB · demais banners 200–303 KB cada.
- Banners: 1017×453 px. `topo1.jpg`: 1920×713. `topo2.jpg`: 700×1194.

---

## Etapa 4 — Acessibilidade (🟡)

| # | Achado | Sev. | Local |
|---|--------|------|-------|
| 4.1 | `alt` do loader diz **"Logo K2 Business"** — texto de template, errado | 🟡 | `index.html:99` |
| 4.2 | `alt` dos banners genéricos e **repetidos** ("Banner 5" colado nos banners 6, 7 e 8) | 🟡 | `index.html:128-130` |
| 4.3 | Links sociais e banners sem `aria-label` descritivo | 🟢 | — |
| 4.4 | Footer `#888` sobre preto → contraste abaixo do WCAG AA | 🟢 | `style.css:73` |

---

## Etapa 5 — HTML / Código (🟡)

| # | Achado | Sev. | Local |
|---|--------|------|-------|
| 5.1 | `<font size="3">` — tag **obsoleta** desde HTML4 | 🟡 | `index.html:119` |
| 5.2 | CSS dividido em dois lugares (`<style>` inline no `<head>` + `style.css`) → consolidar | 🟢 | — |
| 5.3 | Regra `.banners img` duplicada no CSS | 🟢 | `style.css:66,115` |
| 5.4 | Comentários/nomes de template sobrando ("Coloque sua logo…", "K2 Business") | 🟢 | — |

---

## Etapa 6 — Responsividade (🟡)

| # | Achado | Sev. |
|---|--------|------|
| 6.1 | **Dois breakpoints conflitantes**: troca de banner usa `768px` (inline), mas o `.hero` muda em `600px` (css). Entre **601–768 px** o layout fica híbrido/inconsistente | 🟡 |
| 6.2 | Mesmo problema do 3.1: as duas versões de banner sempre baixam | 🟡 |

---

## Etapa 7 — Segurança / Boas práticas (🟡)

| # | Achado | Sev. |
|---|--------|------|
| 7.1 | **Todos os `target="_blank"` sem `rel="noopener noreferrer"`** → vulnerável a *reverse tabnabbing* + perda de performance | 🟡 |

---

## Plano de correção sugerido (ordem de impacto)

1. **Etapa 1** — confirmar e corrigir Instagram + WhatsApp. (conversão imediata)
2. **Etapa 3.1 + 3.2** — eliminar banners duplicados, converter PNG → WebP. (5,5 MB → ~800 KB)
3. **Etapa 2.1 + 2.2** — meta description + Open Graph. (link com foto no WhatsApp)
4. **Etapa 3.3** — loader some assim que a página carrega (sem espera fixa de 2,5 s).
5. **Etapas 4, 5, 6, 7** — limpeza de código, alt texts, breakpoints, `rel=noopener`.
6. **Etapa 2.3 + 2.4** — Schema.org Restaurant + título com keywords.
