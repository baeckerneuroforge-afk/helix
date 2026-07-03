import Link from 'next/link';
import { requireTenant } from '@/lib/auth-context';
import { NO_KNOWLEDGE_ANSWER, SOURCES_MARKER } from '@/lib/rag';
import { withTenant } from '@/lib/tenant';
import { getFeedbackStats, getOwnFeedback } from '@/lib/rag';
import { askQuestion, rateAnswer } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Split a persisted assistant message into answer text + source titles.
 * Canonical format (see src/lib/rag/answer.ts): the grounded answer ends with
 * one line `Quellen: <Titel1>, <Titel2>, …` — rendered here as source chips,
 * never as running text (no double display).
 */
function splitSources(content: string): { text: string; sources: string[] } {
  const idx = content.lastIndexOf(`\n\n${SOURCES_MARKER} `);
  if (idx === -1) return { text: content, sources: [] };
  return {
    text: content.slice(0, idx),
    sources: content
      .slice(idx + SOURCES_MARKER.length + 3)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export default async function ChatPage() {
  const { orgId, userId } = await requireTenant();

  // Last 50 messages of THIS USER in THIS tenant. Per-actor since 0010: chat
  // answers can contain role-gated knowledge, so showing the whole org's
  // history would leak a lead's confidential answers to members. Pre-0010
  // rows (actor_id NULL) stay hidden — fail-closed.
  const messages = (
    await withTenant(orgId, (tx) =>
      tx.chatMessage.findMany({
        where: { actorId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    )
  ).reverse();

  // Feedback: the caller's own votes (active-button state) + org-wide counts.
  // Independent reads in separate withTenant transactions → run them in parallel.
  const [ownVotes, stats] = await Promise.all([
    getOwnFeedback(
      orgId,
      userId,
      messages.filter((m) => m.role === 'assistant').map((m) => m.id),
    ),
    getFeedbackStats(orgId),
  ]);

  return (
    <div className="chat-page">
      <p className="page-intro">
        Antworten kommen ausschließlich aus der{' '}
        <Link href="/dashboard/knowledge">Wissensbasis</Link> dieser Organisation. Ohne passendes
        Wissen sagt der Assistent das ehrlich.
        {stats.up + stats.down > 0 ? (
          <span className="row-meta"> · Feedback bisher: {stats.up} 👍 / {stats.down} 👎</span>
        ) : null}
      </p>

      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8z" />
            </svg>
            <strong>Noch keine Nachrichten</strong>
            <span>Stelle unten die erste Frage — die Antwort kommt mit Quellenangaben.</span>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="bubble bubble--user">
                  {msg.content}
                </div>
              );
            }
            const { text, sources } = splitSources(msg.content);
            const noKnowledge = text.trim() === NO_KNOWLEDGE_ANSWER;
            return (
              <div
                key={msg.id}
                className={`bubble bubble--assistant${noKnowledge ? ' bubble--empty' : ''}`}
              >
                {text}
                {sources.length > 0 ? (
                  <div className="bubble-sources">
                    {sources.map((s) => (
                      <span key={s} className="chip chip--indigo">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="bubble-sources" aria-label="Antwort bewerten">
                  {(['up', 'down'] as const).map((verdict) => (
                    <form key={verdict} action={rateAnswer} style={{ display: 'inline-block' }}>
                      <input type="hidden" name="messageId" value={msg.id} />
                      <input type="hidden" name="verdict" value={verdict} />
                      <button
                        type="submit"
                        className="btn btn--ghost select--inline"
                        title={verdict === 'up' ? 'Hilfreich' : 'Nicht hilfreich'}
                        style={ownVotes[msg.id] === verdict ? { fontWeight: 700 } : undefined}
                      >
                        {verdict === 'up' ? '👍' : '👎'}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="chat-input">
        <form action={askQuestion}>
          <input
            name="question"
            placeholder="z. B. Wie viele Urlaubstage haben wir?"
            aria-label="Frage"
            autoComplete="off"
            required
          />
          <button type="submit" className="btn btn--primary">
            Fragen
          </button>
        </form>
      </div>
    </div>
  );
}
