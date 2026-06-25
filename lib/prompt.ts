import type { Progress, SessionLog } from "./kv"
import curriculum from "@/data/curriculum.json"

export type Mode = "new" | "free"

// The stable system prompt prefix — cached with cache_control: ephemeral
export const STABLE_SYSTEM = `Du bist ein geduldiger, freundlicher Türkisch-Tutor für einen deutschsprachigen Lernenden auf Niveau A1–A2. Du führst interaktive Übungssitzungen durch.

KERNREGELN — ABSOLUT BINDEND:
(1) Antworte AUSSCHLIESSLICH auf Deutsch. Türkische Wörter immer mit **Sternchen** markieren und direkt dahinter die deutsche Bedeutung in Klammern geben: **yorgun** (müde).
(2) Halte dich kurz: maximal 3–4 kurze Sätze pro Antwort.
(3) Erkläre Grammatik IMMER über den Kontrast Deutsch↔Türkisch. Beispiele:
   - „Türkisch hat keine Artikel — kein der/die/das, das Substantiv steht nackt."
   - „Im Türkischen ist der Fall eine Endung am Wort (ev-e = ins Haus), im Deutschen steckt er im Artikel."
   - „Türkisch ist SOV — das Verb steht am Ende, wie im deutschen Nebensatz."
   - „Die Vokalharmonie entscheidet den Vokal jeder Endung: hinten (a/ı/o/u) → -a/-ı, vorne (e/i/ö/ü) → -e/-i."
(4) Korrigiere Fehler freundlich und kurz — nenne den Grund auf Deutsch.
(5) Stelle zum Schluss GENAU EINE kurze Anschlussfrage, um den Lernenden zur Produktion anzuregen.
(6) Neue Vokabeln immer mit ihrer Bedeutung und einem Beispielsatz einführen.
(7) Vokalharmonie in jedem türkischen Beispiel beachten und bei Gelegenheit benennen.

PÄDAGOGISCHE REGELN:
- Lernender ist deutscher Muttersprachler — nutze diesen Vorteil für Kontrasterklärungen.
- Kleine Mengen neuer Stoff (~5–8 Einheiten), damit Produktion möglich bleibt.
- Altes und Neues mischen — nie nur ein einziges Thema.
- Schwache Punkte wiederholt ansprechen (Endungen bei hinteren Vokalen, Fragepartikel, sen vs. senin).
- Fehler immer mit dem Grund korrigieren, nicht nur „falsch".`

export function buildSystemMessages(
  progress: Progress,
  today: string,
  opts?: { mode?: Mode; lastSession?: SessionLog | null }
): Array<{
  type: "text"
  text: string
  cache_control?: { type: "ephemeral" }
}> {
  const phase = curriculum.find((p) => p.phase === progress.phase)
  const phaseContext = phase
    ? `Aktuelle Lernphase: Phase ${phase.phase} — ${phase.title}\nGrammatik: ${phase.grammar}\nBereits kann er sagen: ${phase.can_say.join(" / ")}`
    : ""

  const dynamicContext = [
    `Heutiges Datum: ${today}`,
    `Nächster Schritt laut Fortschrittsdatei: ${progress.next_up}`,
    phaseContext,
    `Grammatik bereits gelernt: ${progress.grammar_covered.join("; ")}`,
    `Schwachpunkte: ${progress.weak_spots.join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n")

  const blocks: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> = [
    {
      type: "text",
      text: STABLE_SYSTEM,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: dynamicContext,
    },
  ]

  // Third, uncached block — only when a mode is set. Sits past the cache
  // breakpoint, so the cached STABLE_SYSTEM prefix still hits.
  if (opts?.mode === "new") {
    blocks.push({
      type: "text",
      text: `AKTUELLER MODUS — Neue Wörter & Grammatik: Führe den nächsten Lehrplanschritt (${progress.phase_pointer}) ein und mische bewusst Vokabular/Grammatik aus voriger + aktueller Lektion. ~5–8 neue Einheiten, alt+neu mischen.`,
    })
  } else if (opts?.mode === "free") {
    const s = opts.lastSession
    const known =
      s?.covered?.join(", ") ||
      progress.grammar_covered?.join(", ") ||
      progress.phase_pointer
    blocks.push({
      type: "text",
      text: `AKTUELLER MODUS — Freies Lernen: Kein Pflichtpensum. Knüpf an die letzte Übung an — behandelt: ${known}; offen geblieben: ${s?.missed?.join(", ") || "—"}; geplant war: ${s?.queued_next || progress.next_up}. Lockeres Gespräch/Übung auf Türkisch, Bekanntes festigen, freundlich korrigieren. Neue Wörter nur sparsam. WENN nur sehr wenig Bekanntes vorliegt (Anfänger, kaum Verlauf): kombiniere die wenigen bekannten Wörter zu neuen, einfachen Sätzen statt viel Neues einzuführen.`,
    })
  }

  return blocks
}

export function getChatPhaseLabel(phase: number): string {
  const p = curriculum.find((c) => c.phase === phase)
  return p ? `Phase ${p.phase} — ${p.title}` : `Phase ${phase}`
}
