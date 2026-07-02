// Skill: angebot_erstellen — Konditionen aus der Wissensbasis holen, Angebot
// entwerfen und (NACH menschlicher Freigabe) an den Kunden "versenden".
//
// Der Beweis für "Freigabe wegen EXTERNER WIRKUNG, nicht wegen Geld":
// handlesMoney ist false, aber die Guardrail triggert IMMER — ein Angebot
// verlässt das Unternehmen, unabhängig vom Betrag. Auch ein 1-€-Angebot
// pausiert in awaiting_approval. amountOf liefert den Betrag trotzdem, damit
// Threshold-Policies (Phase 4) ihn sehen, falls ein Tenant die Regel bewusst
// lockert — der Default (keine Policy) ist immer Freigabe.
//
// Der Versand ist simuliert (Detail + Audit), wie alle Effekte des Katalogs.
import type { SkillDef, SkillJson } from '../types';
import { holeWissen, rolleAusInput } from './wissen';

export const ANGEBOT_GUARDRAIL_REASON =
  'Externe Kommunikation — Angebot verlässt das Unternehmen, Freigabe erforderlich';

interface AngebotInput {
  kunde: string;
  leistung: string;
  betragEur: number;
}

function parseInput(input: SkillJson): AngebotInput {
  const kunde = typeof input.kunde === 'string' ? input.kunde.trim() : '';
  const leistung = typeof input.leistung === 'string' ? input.leistung.trim() : '';
  const betragEur = typeof input.betragEur === 'number' ? input.betragEur : NaN;
  if (!kunde) throw new Error('angebot_erstellen: input.kunde is required.');
  if (!leistung) throw new Error('angebot_erstellen: input.leistung is required.');
  if (!Number.isFinite(betragEur) || betragEur <= 0) {
    throw new Error('angebot_erstellen: input.betragEur must be a positive number.');
  }
  return { kunde, leistung, betragEur };
}

export const angebotErstellen: SkillDef = {
  key: 'angebot_erstellen',
  title: 'Kundenangebot erstellen und versenden',
  handlesMoney: false,
  // IMMER triggern: der Grund ist die externe Wirkung, nicht der Betrag.
  guardrail: () => ({ triggered: true, reason: ANGEBOT_GUARDRAIL_REASON }),
  amountOf: (input) =>
    typeof input.betragEur === 'number' && Number.isFinite(input.betragEur)
      ? input.betragEur
      : null,
  steps: [
    {
      // liest nur: Preise/Konditionen rollenbewusst aus der Wissensbasis.
      name: 'konditionen_geholt',
      run: async ({ orgId, tx, input }) => {
        const { leistung } = parseInput(input);
        const rolle = rolleAusInput(input);
        const treffer = await holeWissen(tx, {
          orgId,
          frage: `Preise Konditionen Rabatt Zahlungsziel ${leistung}`,
          rolle,
          k: 3,
        });
        return {
          rolle: rolle || null,
          konditionen: treffer.map((t) => ({ titel: t.titel, auszug: t.auszug })),
          quellen: [...new Set(treffer.map((t) => t.titel))],
        };
      },
    },
    {
      // liest nur: Angebotsentwurf aus Input + gefundenen Konditionen.
      name: 'angebot_entworfen',
      run: async ({ input, state }) => {
        const { kunde, leistung, betragEur } = parseInput(input);
        const konditionsHinweise = (state.konditionen_geholt?.konditionen ?? []) as Array<{
          titel: string;
          auszug: string;
        }>;
        return {
          empfaenger: kunde,
          leistung,
          betragEur,
          entwurf: [
            `Angebot für ${kunde}`,
            `Leistung: ${leistung}`,
            `Angebotssumme: ${betragEur.toFixed(2)} EUR`,
            konditionsHinweise.length > 0
              ? `Konditionen laut Wissensbasis:\n${konditionsHinweise.map((k) => `- [${k.titel}] ${k.auszug}`).join('\n')}`
              : 'Konditionen: Standardkonditionen (kein spezifisches Wissen sichtbar).',
          ].join('\n'),
        };
      },
    },
    {
      // Der HANDELNDE Schritt: simulierter Versand an den Kunden — läuft erst
      // nach menschlicher Freigabe (Guardrail triggert immer).
      name: 'versendet',
      acts: true,
      run: async ({ input }) => {
        const { kunde, betragEur } = parseInput(input);
        return {
          versendet: true,
          empfaenger: kunde,
          betragEur,
          simuliert: true, // kein echter E-Mail-/Portal-Versand in dieser Phase
        };
      },
    },
  ],
};
