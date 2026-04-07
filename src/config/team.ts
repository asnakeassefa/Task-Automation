import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface TeamMember {
  name: string;
  email: string;
  role: string;
  level: string;
}

export function loadTeam(): TeamMember[] {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.resolve(dir, 'team.json');

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

export function findAssignee(
  suggestedRole: string | null,
  suggestedLevel: string | null,
  team: TeamMember[],
): TeamMember | null {
  if (team.length === 0 || !suggestedRole) return null;

  const role = suggestedRole.toLowerCase();
  const level = suggestedLevel?.toLowerCase() ?? 'any';

  if (level !== 'any') {
    const exact = team.find(
      (m) => m.role.toLowerCase() === role && m.level.toLowerCase() === level,
    );
    if (exact) return exact;
  }

  const roleMatch = team.find((m) => m.role.toLowerCase() === role);
  if (roleMatch) return roleMatch;

  return null;
}
