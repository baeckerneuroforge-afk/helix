// Skill catalog — the registry the engine resolves skill keys against.
// Adding a skill = adding a SkillDef here; the engine, tables and audit
// mechanics are shared.
import type { SkillDef } from '../types';
import { angebotErstellen } from './angebot_erstellen';
import { belegKontieren } from './beleg_kontieren';
import { rechnungErstellen } from './rechnung_erstellen';
import { wissenZusammenfassen } from './wissen_zusammenfassen';

const SKILLS: Record<string, SkillDef> = {
  [belegKontieren.key]: belegKontieren,
  [wissenZusammenfassen.key]: wissenZusammenfassen,
  [angebotErstellen.key]: angebotErstellen,
  [rechnungErstellen.key]: rechnungErstellen,
};

export function getSkill(key: string): SkillDef {
  const skill = SKILLS[key];
  if (!skill) throw new Error(`Unknown skill: ${JSON.stringify(key)}`);
  return skill;
}

export function listSkills(): SkillDef[] {
  return Object.values(SKILLS);
}
