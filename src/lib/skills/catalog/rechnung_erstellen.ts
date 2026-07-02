// Skill: rechnung_erstellen — Stammdaten prüfen, Rechnung erzeugen und (nach
// Guardrail/Freigabe) "buchen und versenden".
//
// Der zweite GELD-Skill neben beleg_kontieren: handlesMoney:true, dieselbe
// Betrag-Guardrail-Semantik (Summe über 1.000 € ⇒ awaiting_approval, bis ein
// Mensch freigibt), amountOf liefert die Summe für Threshold-Policies.
// Buchung/Versand sind simuliert (Detail + Audit) — keine echte Anbindung.
import type { SkillDef, SkillJson } from '../types';

export const RECHNUNG_GUARDRAIL_LIMIT_EUR = 1000;
export const RECHNUNG_GUARDRAIL_REASON =
  'Rechnungssumme über 1.000 € — Freigabe erforderlich';

interface Position {
  bezeichnung: string;
  betragEur: number;
}

interface RechnungInput {
  kunde: string;
  positionen: Position[];
  summeEur: number;
}

/** Summe des Inputs — Basis für Guardrail und amountOf. Nicht bestimmbar ⇒
 * null (Threshold-Policies und Guardrail behandeln das fail-closed). */
function summeOf(input: SkillJson): number | null {
  if (typeof input.summeEur === 'number' && Number.isFinite(input.summeEur)) {
    return input.summeEur;
  }
  if (Array.isArray(input.positionen)) {
    let summe = 0;
    for (const p of input.positionen) {
      const betrag = (p as Record<string, unknown>)?.betragEur;
      if (typeof betrag !== 'number' || !Number.isFinite(betrag)) return null;
      summe += betrag;
    }
    return input.positionen.length > 0 ? summe : null;
  }
  return null;
}

function parseInput(input: SkillJson): RechnungInput {
  const kunde = typeof input.kunde === 'string' ? input.kunde.trim() : '';
  if (!kunde) throw new Error('rechnung_erstellen: input.kunde is required.');

  if (!Array.isArray(input.positionen) || input.positionen.length === 0) {
    throw new Error('rechnung_erstellen: input.positionen must be a non-empty array.');
  }
  const positionen: Position[] = input.positionen.map((raw, i) => {
    const p = raw as Record<string, unknown>;
    const bezeichnung = typeof p?.bezeichnung === 'string' ? p.bezeichnung.trim() : '';
    const betragEur = typeof p?.betragEur === 'number' ? p.betragEur : NaN;
    if (!bezeichnung) {
      throw new Error(`rechnung_erstellen: positionen[${i}].bezeichnung is required.`);
    }
    if (!Number.isFinite(betragEur) || betragEur <= 0) {
      throw new Error(`rechnung_erstellen: positionen[${i}].betragEur must be a positive number.`);
    }
    return { bezeichnung, betragEur };
  });

  const berechnet = positionen.reduce((s, p) => s + p.betragEur, 0);
  // Explizit mitgegebene Summe muss zu den Positionen passen (fail-closed
  // gegen manipulierte Inputs: nie eine andere Summe buchen als ausgewiesen).
  if (typeof input.summeEur === 'number' && Number.isFinite(input.summeEur)) {
    if (Math.abs(input.summeEur - berechnet) > 0.01) {
      throw new Error(
        `rechnung_erstellen: summeEur (${input.summeEur.toFixed(2)}) does not match ` +
          `the positions total (${berechnet.toFixed(2)}).`,
      );
    }
  }
  return { kunde, positionen, summeEur: berechnet };
}

export const rechnungErstellen: SkillDef = {
  key: 'rechnung_erstellen',
  title: 'Rechnung erstellen und buchen',
  handlesMoney: true,
  guardrail: (input) => {
    const summe = summeOf(input);
    // Fail-closed: nicht bestimmbare Summe verhält sich wie "über der Schwelle".
    if (summe === null || summe > RECHNUNG_GUARDRAIL_LIMIT_EUR) {
      return { triggered: true, reason: RECHNUNG_GUARDRAIL_REASON };
    }
    return { triggered: false };
  },
  amountOf: summeOf,
  steps: [
    {
      // liest nur: Input-/Stammdaten-Validierung (fail ⇒ Run wird 'failed',
      // bevor irgendein handelnder Schritt erreichbar ist).
      name: 'stammdaten_geprueft',
      run: async ({ input }) => {
        const { kunde, positionen, summeEur } = parseInput(input);
        return { kunde, positionsAnzahl: positionen.length, summeEur, geprueft: true };
      },
    },
    {
      // liest nur: Rechnung als Dokumentstruktur erzeugen (deterministisch).
      name: 'rechnung_erzeugt',
      run: async ({ input }) => {
        const { kunde, positionen, summeEur } = parseInput(input);
        return {
          empfaenger: kunde,
          positionen: positionen.map((p, i) => ({
            pos: i + 1,
            bezeichnung: p.bezeichnung,
            betragEur: p.betragEur,
          })),
          summeEur,
          rechnungstext: `Rechnung an ${kunde} — ${positionen.length} Position(en), gesamt ${summeEur.toFixed(2)} EUR`,
        };
      },
    },
    {
      // Der HANDELNDE Schritt: simulierte Buchung + Versand — gated durch die
      // Betrag-Guardrail (Summe > 1.000 € ⇒ erst nach menschlicher Freigabe).
      name: 'gebucht_versendet',
      acts: true,
      run: async ({ input }) => {
        const { kunde, summeEur } = parseInput(input);
        return {
          gebucht: true,
          versendetAn: kunde,
          summeEur,
          simuliert: true, // keine echte Buchhaltungs-/Versand-Anbindung
        };
      },
    },
  ],
};
