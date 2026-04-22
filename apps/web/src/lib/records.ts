import { initDevice, loadTotem } from './totem';
import type { TotemData } from './totem';
import { getThread, getRecord, type ThreadSession, type FullSession, type ConversationTurn } from './api';

export type { FullSession, ConversationTurn };

export type MergedFullRecord = FullSession & {
  encrypted_note: string | null;
  encrypted_feedback: string | null;
  encrypted_context: string | null;
  encrypted_beliefs: string[];
  encrypted_rite_name: string | null;
  encrypted_quality: string | null;
  /** Last affect snapshot from the conversation, if present. */
  affect: ConversationTurn['affect'] | null;
};

export type TotemRecord = NonNullable<TotemData['sessions']>[number];

export type MergedRecord = ThreadSession & {
  encrypted_note: string | null;
  encrypted_feedback: string | null;
  encrypted_context: string | null;
  encrypted_beliefs: string[];
  encrypted_rite_name: string | null;
  encrypted_quality: string | null;
};

export async function loadMergedRecords(seekerId: string, token: string): Promise<MergedRecord[]> {
  const thread = await getThread(seekerId, token);
  let totem = await loadTotem(seekerId, token).catch(() => null);
  if (!totem) {
    try {
      const result = await initDevice(token);
      totem = result.totemData;
    } catch {
      totem = null;
    }
  }

  const sessionMap = new Map<string, TotemRecord>();
  for (const entry of totem?.sessions ?? []) {
    const key = entry.session_id ?? entry.id;
    if (key) sessionMap.set(key, entry);
  }

  return thread.map((session) => {
    const encrypted = sessionMap.get(session.id);
    return {
      ...session,
      encrypted_note: encrypted?.note ?? null,
      encrypted_feedback: encrypted?.feedback ?? null,
      encrypted_context: encrypted?.context ?? null,
      encrypted_beliefs: encrypted?.beliefs ?? [],
      encrypted_rite_name: encrypted?.rite_name ?? null,
      encrypted_quality: encrypted?.dominant_quality ?? encrypted?.quality ?? null,
    };
  }).filter((session) => session.stage === 'complete' || session.stage === 'prescribed');
}

export async function loadSingleRecord(
  sessionId: string,
  seekerId: string,
  token: string,
): Promise<MergedFullRecord> {
  const [session, totem] = await Promise.all([
    getRecord(sessionId, token),
    loadTotem(seekerId, token).catch(async () => {
      try { return (await initDevice(token)).totemData; } catch { return null; }
    }),
  ]);

  const sessionMap = new Map<string, TotemRecord>();
  for (const entry of (totem as TotemData | null)?.sessions ?? []) {
    const key = entry.session_id ?? entry.id;
    if (key) sessionMap.set(key, entry);
  }
  const encrypted = sessionMap.get(sessionId);

  // Extract the last affect reading from conversation turns
  const turns = session.conversation ?? [];
  const lastAffect = [...turns].reverse().find((t) => t.affect)?.affect ?? null;

  return {
    ...session,
    encrypted_note: encrypted?.note ?? null,
    encrypted_feedback: encrypted?.feedback ?? null,
    encrypted_context: encrypted?.context ?? null,
    encrypted_beliefs: encrypted?.beliefs ?? [],
    encrypted_rite_name: encrypted?.rite_name ?? null,
    encrypted_quality: encrypted?.dominant_quality ?? encrypted?.quality ?? null,
    affect: lastAffect,
  };
}

export function reportText(report: unknown): string | null {
  if (!report) return null;
  if (typeof report === 'string') return report;
  if (typeof report === 'object') {
    const maybe = report as { notes?: string; unexpected?: string };
    return maybe.notes ?? maybe.unexpected ?? null;
  }
  return null;
}
