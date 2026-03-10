import { db } from "./db";
import { conversations, messages, agentSettings, skills, personas, memoryEntries, dailyNotes, providerKeys, heartbeatTasks, heartbeatLogs, agentKnowledge, conversationTemplates } from "@shared/schema";
import type {
  Conversation, InsertConversation, Message, InsertMessage,
  AgentSettings, InsertSettings, Skill, InsertSkill,
  Persona, InsertPersona, MemoryEntry, InsertMemoryEntry,
  DailyNote, InsertDailyNote, ProviderKey, InsertProviderKey,
  HeartbeatTask, InsertHeartbeatTask, HeartbeatLog, InsertHeartbeatLog,
  AgentKnowledge, InsertKnowledge,
  ConversationTemplate, InsertConversationTemplate,
} from "@shared/schema";
import { eq, desc, and, sql, inArray, lte, gt, lt, isNull, or, ne } from "drizzle-orm";
import { getNextCronRun } from "./cron-utils";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export interface IStorage {
  getConversations(limit?: number, offset?: number): Promise<PaginatedResult<Conversation>>;
  getConversation(id: number): Promise<Conversation | undefined>;
  createConversation(data: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, data: Partial<InsertConversation>): Promise<Conversation | undefined>;
  deleteConversation(id: number): Promise<void>;
  getMessages(conversationId: number): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  getSettings(): Promise<AgentSettings | undefined>;
  upsertSettings(data: InsertSettings): Promise<AgentSettings>;
  getSkills(): Promise<Skill[]>;
  getEnabledSkillsWithPrompts(): Promise<Skill[]>;
  updateSkill(id: number, data: Partial<InsertSkill>): Promise<Skill | undefined>;
  getPersonas(): Promise<Persona[]>;
  getPersona(id: number): Promise<Persona | undefined>;
  getActivePersona(): Promise<Persona | undefined>;
  createPersona(data: InsertPersona): Promise<Persona>;
  updatePersona(id: number, data: Partial<InsertPersona>): Promise<Persona | undefined>;
  deletePersona(id: number): Promise<void>;
  setActivePersona(id: number): Promise<void>;
  getMemoryEntries(personaId?: number, limit?: number, offset?: number): Promise<PaginatedResult<MemoryEntry>>;
  createMemoryEntry(data: InsertMemoryEntry): Promise<MemoryEntry>;
  updateMemoryEntry(id: number, data: Partial<InsertMemoryEntry>): Promise<MemoryEntry | undefined>;
  deleteMemoryEntry(id: number): Promise<void>;
  touchMemoryEntries(ids: number[]): Promise<void>;
  getDailyNotes(personaId?: number): Promise<DailyNote[]>;
  getDailyNote(date: string, personaId?: number): Promise<DailyNote | undefined>;
  upsertDailyNote(data: InsertDailyNote): Promise<DailyNote>;
  getProviderKeys(): Promise<ProviderKey[]>;
  getProviderKey(provider: string): Promise<ProviderKey | undefined>;
  upsertProviderKey(data: InsertProviderKey): Promise<ProviderKey>;
  deleteProviderKey(provider: string): Promise<void>;
  getKnowledge(personaId?: number, limit?: number, offset?: number): Promise<PaginatedResult<AgentKnowledge>>;
  createKnowledge(data: InsertKnowledge): Promise<AgentKnowledge>;
  updateKnowledge(id: number, data: Partial<InsertKnowledge>): Promise<AgentKnowledge | undefined>;
  deleteKnowledge(id: number): Promise<void>;
  updateMemoryEmbedding(id: number, embedding: number[]): Promise<void>;
  updateKnowledgeEmbedding(id: number, embedding: number[]): Promise<void>;
  getMemoriesWithoutEmbeddings(limit?: number): Promise<MemoryEntry[]>;
  getKnowledgeWithoutEmbeddings(limit?: number): Promise<AgentKnowledge[]>;
  archiveExpiredMemories(): Promise<number>;
  archiveStaleMemories(olderThanDays: number): Promise<number>;
  pruneHeartbeatLogs(keepCount: number): Promise<number>;
  getMemoryStats(personaId?: number): Promise<{ active: number; archived: number; total: number; byCategory: Record<string, number>; knowledgeCount: number }>;
  getRecentDailyNotes(days: number, personaId?: number): Promise<DailyNote[]>;
  getHeartbeatTasks(personaId?: number): Promise<HeartbeatTask[]>;
  getHeartbeatTask(id: number): Promise<HeartbeatTask | undefined>;
  createHeartbeatTask(data: InsertHeartbeatTask): Promise<HeartbeatTask>;
  updateHeartbeatTask(id: number, data: Partial<InsertHeartbeatTask>): Promise<HeartbeatTask | undefined>;
  deleteHeartbeatTask(id: number): Promise<void>;
  getDueHeartbeatTasks(): Promise<HeartbeatTask[]>;
  markHeartbeatTaskRun(id: number, nextRunAt: Date): Promise<void>;
  getHeartbeatLogs(limit?: number, personaId?: number): Promise<HeartbeatLog[]>;
  createHeartbeatLog(data: InsertHeartbeatLog): Promise<HeartbeatLog>;
  getHeartbeatTasksByPersona(personaId: number): Promise<HeartbeatTask[]>;
  searchConversations(query: string): Promise<Array<Conversation & { snippet?: string }>>;
  getAllDataForExport(): Promise<any>;
  getConversationTemplates(): Promise<ConversationTemplate[]>;
  createConversationTemplate(data: InsertConversationTemplate): Promise<ConversationTemplate>;
  updateConversationTemplate(id: number, data: Partial<InsertConversationTemplate>): Promise<ConversationTemplate | undefined>;
  deleteConversationTemplate(id: number): Promise<void>;
  getAnalytics(): Promise<any>;
  getContextSummary(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getConversations(limit = 50, offset = 0): Promise<PaginatedResult<Conversation>> {
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(conversations);
    const total = countResult.count;
    const data = await db.select().from(conversations).orderBy(desc(conversations.updatedAt)).limit(limit).offset(offset);
    return { data, total, hasMore: offset + data.length < total };
  }
  async getConversation(id: number) {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv;
  }
  async createConversation(data: InsertConversation) {
    const [conv] = await db.insert(conversations).values(data).returning();
    return conv;
  }
  async updateConversation(id: number, data: Partial<InsertConversation>) {
    const [conv] = await db.update(conversations).set({ ...data, updatedAt: new Date() }).where(eq(conversations.id, id)).returning();
    return conv;
  }
  async deleteConversation(id: number) {
    await db.delete(conversations).where(eq(conversations.id, id));
  }
  async getMessages(conversationId: number) {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  }
  async createMessage(data: InsertMessage) {
    const [msg] = await db.insert(messages).values(data).returning();
    return msg;
  }
  async getSettings() {
    const [s] = await db.select().from(agentSettings).limit(1);
    return s;
  }
  async upsertSettings(data: InsertSettings) {
    const existing = await this.getSettings();
    if (existing) {
      const [s] = await db.update(agentSettings).set(data).where(eq(agentSettings.id, existing.id)).returning();
      return s;
    }
    const [s] = await db.insert(agentSettings).values(data).returning();
    return s;
  }
  async getSkills() {
    return db.select().from(skills).orderBy(skills.category, skills.name);
  }
  async getEnabledSkillsWithPrompts() {
    return db.select().from(skills).where(and(eq(skills.enabled, true), sql`${skills.promptContent} IS NOT NULL`));
  }
  async updateSkill(id: number, data: Partial<InsertSkill>) {
    const [skill] = await db.update(skills).set(data).where(eq(skills.id, id)).returning();
    return skill;
  }

  // ─── Personas ─────────────────────────────────────────────
  async getPersonas() {
    return db.select().from(personas).orderBy(desc(personas.isActive), personas.name);
  }
  async getPersona(id: number) {
    const [p] = await db.select().from(personas).where(eq(personas.id, id));
    return p;
  }
  async getActivePersona() {
    const [p] = await db.select().from(personas).where(eq(personas.isActive, true)).limit(1);
    return p;
  }
  async createPersona(data: InsertPersona) {
    if (data.isActive) {
      await db.update(personas).set({ isActive: false });
    }
    const [p] = await db.insert(personas).values(data).returning();
    return p;
  }
  async updatePersona(id: number, data: Partial<InsertPersona>) {
    if (data.isActive) {
      await db.update(personas).set({ isActive: false });
    }
    const [p] = await db.update(personas).set(data).where(eq(personas.id, id)).returning();
    return p;
  }
  async deletePersona(id: number) {
    await db.update(conversations).set({ personaId: null }).where(eq(conversations.personaId, id));
    await db.update(memoryEntries).set({ status: "superseded" }).where(eq(memoryEntries.personaId, id));
    await db.delete(dailyNotes).where(eq(dailyNotes.personaId, id));
    await db.delete(personas).where(eq(personas.id, id));
  }
  async setActivePersona(id: number) {
    const persona = await this.getPersona(id);
    if (!persona) throw new Error("Persona not found");
    await db.update(personas).set({ isActive: false });
    await db.update(personas).set({ isActive: true }).where(eq(personas.id, id));
  }

  // ─── Memory ─────────────────────────────────────────────
  async getMemoryEntries(personaId?: number, limit = 100, offset = 0): Promise<PaginatedResult<MemoryEntry>> {
    const conditions = [eq(memoryEntries.status, "active")];
    if (personaId) conditions.push(eq(memoryEntries.personaId, personaId));
    const where = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(memoryEntries).where(where);
    const total = countResult.count;
    const data = await db.select().from(memoryEntries).where(where).orderBy(desc(memoryEntries.lastAccessed)).limit(limit).offset(offset);
    return { data, total, hasMore: offset + data.length < total };
  }
  async createMemoryEntry(data: InsertMemoryEntry) {
    const [entry] = await db.insert(memoryEntries).values(data).returning();
    return entry;
  }
  async updateMemoryEntry(id: number, data: Partial<InsertMemoryEntry>) {
    const [entry] = await db.update(memoryEntries).set(data).where(eq(memoryEntries.id, id)).returning();
    return entry;
  }
  async deleteMemoryEntry(id: number) {
    await db.update(memoryEntries).set({ status: "superseded" }).where(eq(memoryEntries.id, id));
  }
  async touchMemoryEntries(ids: number[]) {
    if (ids.length === 0) return;
    await db.update(memoryEntries)
      .set({ lastAccessed: new Date(), accessCount: sql`${memoryEntries.accessCount} + 1` })
      .where(inArray(memoryEntries.id, ids));
  }

  // ─── Daily Notes ─────────────────────────────────────────
  async getDailyNotes(personaId?: number) {
    if (personaId) {
      return db.select().from(dailyNotes).where(eq(dailyNotes.personaId, personaId)).orderBy(desc(dailyNotes.date)).limit(30);
    }
    return db.select().from(dailyNotes).orderBy(desc(dailyNotes.date)).limit(30);
  }
  async getDailyNote(date: string, personaId?: number) {
    if (personaId) {
      const [note] = await db.select().from(dailyNotes).where(and(eq(dailyNotes.date, date), eq(dailyNotes.personaId, personaId)));
      return note;
    }
    const [note] = await db.select().from(dailyNotes).where(eq(dailyNotes.date, date));
    return note;
  }
  async upsertDailyNote(data: InsertDailyNote) {
    const existing = await this.getDailyNote(data.date, data.personaId ?? undefined);
    if (existing) {
      const [note] = await db.update(dailyNotes).set({ content: data.content, updatedAt: new Date() }).where(eq(dailyNotes.id, existing.id)).returning();
      return note;
    }
    const [note] = await db.insert(dailyNotes).values(data).returning();
    return note;
  }

  async getProviderKeys() {
    return db.select().from(providerKeys).orderBy(providerKeys.provider);
  }
  async getProviderKey(provider: string) {
    const [key] = await db.select().from(providerKeys).where(eq(providerKeys.provider, provider));
    return key;
  }
  async upsertProviderKey(data: InsertProviderKey) {
    const existing = await this.getProviderKey(data.provider);
    if (existing) {
      const [key] = await db.update(providerKeys).set(data).where(eq(providerKeys.id, existing.id)).returning();
      return key;
    }
    const [key] = await db.insert(providerKeys).values(data).returning();
    return key;
  }
  async deleteProviderKey(provider: string) {
    await db.delete(providerKeys).where(eq(providerKeys.provider, provider));
  }

  // ─── Knowledge Base ─────────────────────────────────────
  async getKnowledge(personaId?: number, limit = 100, offset = 0): Promise<PaginatedResult<AgentKnowledge>> {
    const notExpired = or(isNull(agentKnowledge.expiresAt), gt(agentKnowledge.expiresAt, new Date()));
    const conditions = [notExpired];
    if (personaId !== undefined) {
      conditions.push(or(eq(agentKnowledge.personaId, personaId), isNull(agentKnowledge.personaId)));
    }
    const where = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(agentKnowledge).where(where);
    const total = countResult.count;
    const data = await db.select().from(agentKnowledge).where(where).orderBy(desc(agentKnowledge.priority), desc(agentKnowledge.updatedAt)).limit(limit).offset(offset);
    return { data, total, hasMore: offset + data.length < total };
  }
  async createKnowledge(data: InsertKnowledge) {
    const [entry] = await db.insert(agentKnowledge).values(data).returning();
    return entry;
  }
  async updateKnowledge(id: number, data: Partial<InsertKnowledge>) {
    const [entry] = await db.update(agentKnowledge).set({ ...data, updatedAt: new Date() }).where(eq(agentKnowledge.id, id)).returning();
    return entry;
  }
  async deleteKnowledge(id: number) {
    await db.delete(agentKnowledge).where(eq(agentKnowledge.id, id));
  }

  // ─── Embeddings ─────────────────────────────────────────
  async updateMemoryEmbedding(id: number, embedding: number[]) {
    await db.update(memoryEntries).set({ embedding }).where(eq(memoryEntries.id, id));
  }
  async updateKnowledgeEmbedding(id: number, embedding: number[]) {
    await db.update(agentKnowledge).set({ embedding }).where(eq(agentKnowledge.id, id));
  }
  async getMemoriesWithoutEmbeddings(limit = 50) {
    return db.select().from(memoryEntries)
      .where(and(eq(memoryEntries.status, "active"), isNull(memoryEntries.embedding)))
      .limit(limit);
  }
  async getKnowledgeWithoutEmbeddings(limit = 50) {
    const notExpired = or(isNull(agentKnowledge.expiresAt), gt(agentKnowledge.expiresAt, new Date()));
    return db.select().from(agentKnowledge)
      .where(and(notExpired!, isNull(agentKnowledge.embedding)))
      .limit(limit);
  }

  // ─── Memory Lifecycle ─────────────────────────────────
  async archiveExpiredMemories() {
    const result = await db.update(memoryEntries)
      .set({ status: "archived" })
      .where(and(
        eq(memoryEntries.status, "active"),
        lte(memoryEntries.expiresAt, new Date())
      ))
      .returning();
    return result.length;
  }
  async archiveStaleMemories(olderThanDays: number) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const accessCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const result = await db.update(memoryEntries)
      .set({ status: "archived" })
      .where(and(
        eq(memoryEntries.status, "active"),
        lte(memoryEntries.createdAt, cutoff),
        lte(memoryEntries.lastAccessed, accessCutoff)
      ))
      .returning();
    return result.length;
  }
  async pruneHeartbeatLogs(keepCount: number) {
    const allLogs = await db.select({ id: heartbeatLogs.id }).from(heartbeatLogs).orderBy(desc(heartbeatLogs.createdAt));
    if (allLogs.length <= keepCount) return 0;
    const toDelete = allLogs.slice(keepCount).map(l => l.id);
    if (toDelete.length === 0) return 0;
    await db.delete(heartbeatLogs).where(inArray(heartbeatLogs.id, toDelete));
    return toDelete.length;
  }
  async getMemoryStats(personaId?: number) {
    const condition = personaId !== undefined ? eq(memoryEntries.personaId, personaId) : undefined;
    const allMem = condition
      ? await db.select().from(memoryEntries).where(condition)
      : await db.select().from(memoryEntries);
    const active = allMem.filter(m => m.status === "active").length;
    const archived = allMem.filter(m => m.status === "archived" || m.status === "superseded").length;
    const byCategory: Record<string, number> = {};
    for (const m of allMem.filter(m => m.status === "active")) {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    }
    const knowledgeCondition = personaId !== undefined ? eq(agentKnowledge.personaId, personaId) : undefined;
    const knowledge = knowledgeCondition
      ? await db.select().from(agentKnowledge).where(knowledgeCondition)
      : await db.select().from(agentKnowledge);
    const knowledgeCount = knowledge.filter(k => !k.expiresAt || k.expiresAt > new Date()).length;
    return { active, archived, total: allMem.length, byCategory, knowledgeCount };
  }
  async getRecentDailyNotes(days: number, personaId?: number) {
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dates.push(d.toISOString().split("T")[0]);
    }
    if (personaId !== undefined) {
      return db.select().from(dailyNotes)
        .where(and(inArray(dailyNotes.date, dates), eq(dailyNotes.personaId, personaId)))
        .orderBy(desc(dailyNotes.date));
    }
    return db.select().from(dailyNotes)
      .where(inArray(dailyNotes.date, dates))
      .orderBy(desc(dailyNotes.date));
  }

  // ─── Heartbeat ──────────────────────────────────────────
  async getHeartbeatTasks(personaId?: number) {
    if (personaId !== undefined) {
      return db.select().from(heartbeatTasks).where(eq(heartbeatTasks.personaId, personaId)).orderBy(heartbeatTasks.name);
    }
    return db.select().from(heartbeatTasks).orderBy(heartbeatTasks.name);
  }
  async getHeartbeatTasksByPersona(personaId: number) {
    return db.select().from(heartbeatTasks).where(eq(heartbeatTasks.personaId, personaId)).orderBy(heartbeatTasks.name);
  }
  async getHeartbeatTask(id: number) {
    const [task] = await db.select().from(heartbeatTasks).where(eq(heartbeatTasks.id, id));
    return task;
  }
  async createHeartbeatTask(data: InsertHeartbeatTask) {
    const nextRun = getNextCronRun(data.cronExpression || "*/30 * * * *");
    const [task] = await db.insert(heartbeatTasks).values({ ...data, nextRunAt: nextRun }).returning();
    return task;
  }
  async updateHeartbeatTask(id: number, data: Partial<InsertHeartbeatTask>) {
    const updates: any = { ...data };
    if (data.cronExpression) {
      updates.nextRunAt = getNextCronRun(data.cronExpression);
    }
    const [task] = await db.update(heartbeatTasks).set(updates).where(eq(heartbeatTasks.id, id)).returning();
    return task;
  }
  async deleteHeartbeatTask(id: number) {
    await db.delete(heartbeatTasks).where(eq(heartbeatTasks.id, id));
  }
  async getDueHeartbeatTasks() {
    return db.select().from(heartbeatTasks)
      .where(and(
        eq(heartbeatTasks.enabled, true),
        lte(heartbeatTasks.nextRunAt, new Date()),
      ));
  }
  async markHeartbeatTaskRun(id: number, nextRunAt: Date) {
    await db.update(heartbeatTasks)
      .set({ lastRunAt: new Date(), nextRunAt })
      .where(eq(heartbeatTasks.id, id));
  }
  async getHeartbeatLogs(limit = 50, personaId?: number) {
    if (personaId !== undefined) {
      return db.select().from(heartbeatLogs).where(eq(heartbeatLogs.personaId, personaId)).orderBy(desc(heartbeatLogs.createdAt)).limit(limit);
    }
    return db.select().from(heartbeatLogs).orderBy(desc(heartbeatLogs.createdAt)).limit(limit);
  }
  async createHeartbeatLog(data: InsertHeartbeatLog) {
    const [log] = await db.insert(heartbeatLogs).values(data).returning();
    return log;
  }

  async getConversationTemplates() {
    return db.select().from(conversationTemplates).orderBy(conversationTemplates.category, conversationTemplates.name);
  }
  async createConversationTemplate(data: InsertConversationTemplate) {
    const [t] = await db.insert(conversationTemplates).values(data).returning();
    return t;
  }
  async updateConversationTemplate(id: number, data: Partial<InsertConversationTemplate>) {
    const [t] = await db.update(conversationTemplates).set(data).where(eq(conversationTemplates.id, id)).returning();
    return t;
  }
  async deleteConversationTemplate(id: number) {
    await db.delete(conversationTemplates).where(eq(conversationTemplates.id, id));
  }

  async getAnalytics() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [msgPerDayRows, modelRows, hourlyRows, totalConvResult, totalMsgResult, toolMsgs, userMsgs] = await Promise.all([
      db.execute(sql`
        SELECT to_char(created_at, 'YYYY-MM-DD') as day, role, count(*)::int as cnt
        FROM messages WHERE created_at > ${thirtyDaysAgo}
        GROUP BY day, role ORDER BY day
      `),
      db.execute(sql`
        SELECT COALESCE(model, 'unknown') as model, count(*)::int as cnt
        FROM conversations GROUP BY model ORDER BY cnt DESC
      `),
      db.execute(sql`
        SELECT EXTRACT(HOUR FROM created_at)::int as hour, count(*)::int as cnt
        FROM messages WHERE created_at > ${thirtyDaysAgo} AND role = 'user'
        GROUP BY hour ORDER BY hour
      `),
      db.select({ count: sql<number>`count(*)::int` }).from(conversations),
      db.select({ count: sql<number>`count(*)::int` }).from(messages).where(gt(messages.createdAt, thirtyDaysAgo)),
      db.select({ content: messages.content }).from(messages)
        .where(and(gt(messages.createdAt, thirtyDaysAgo), eq(messages.role, "assistant"), sql`${messages.content} LIKE '<!-- tools:%'`)),
      db.select({ content: messages.content }).from(messages)
        .where(and(gt(messages.createdAt, thirtyDaysAgo), eq(messages.role, "user"))),
    ]);

    const messagesPerDay: Record<string, { user: number; assistant: number }> = {};
    for (const row of msgPerDayRows.rows as any[]) {
      if (!messagesPerDay[row.day]) messagesPerDay[row.day] = { user: 0, assistant: 0 };
      messagesPerDay[row.day][row.role as "user" | "assistant"] = row.cnt;
    }

    const modelUsage: Record<string, number> = {};
    for (const row of modelRows.rows as any[]) {
      modelUsage[row.model] = row.cnt;
    }

    const hourlyActivity: Record<number, number> = {};
    for (const row of hourlyRows.rows as any[]) {
      hourlyActivity[row.hour] = row.cnt;
    }

    const toolUsage: Record<string, number> = {};
    for (const msg of toolMsgs) {
      const toolMatch = msg.content.match(/^<!-- tools:(\[[\s\S]*?\]) -->/);
      if (toolMatch) {
        try {
          const tools = JSON.parse(toolMatch[1]);
          for (const t of tools) {
            toolUsage[t.name] = (toolUsage[t.name] || 0) + 1;
          }
        } catch {}
      }
    }

    const wordFreq: Record<string, number> = {};
    const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "shall", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as", "into", "about", "like", "after", "between", "out", "this", "that", "these", "those", "it", "its", "i", "me", "my", "you", "your", "we", "our", "they", "them", "their", "he", "she", "him", "her", "and", "or", "but", "not", "no", "so", "if", "then", "than", "just", "also", "very", "what", "how", "when", "where", "why", "who", "which", "all", "each", "some", "any", "more", "most"]);
    for (const msg of userMsgs) {
      const words = msg.content.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
      for (const word of words) {
        if (word.length > 3 && !stopWords.has(word)) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      }
    }
    const topTopics = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    return {
      messagesPerDay,
      modelUsage,
      hourlyActivity,
      toolUsage,
      topTopics,
      totalConversations: totalConvResult[0].count,
      totalMessages: totalMsgResult[0].count,
      periodDays: 30,
    };
  }

  async getContextSummary() {
    const now = new Date();
    const hour = now.getHours();
    let greeting: string;
    if (hour < 12) greeting = "Good morning";
    else if (hour < 17) greeting = "Good afternoon";
    else greeting = "Good evening";

    const recentConvs = await db.select().from(conversations).orderBy(desc(conversations.updatedAt)).limit(3);
    const activePersona = await this.getActivePersona();
    const memoryConditions = [eq(memoryEntries.status, "active")];
    if (activePersona) {
      memoryConditions.push(sql`(${memoryEntries.personaId} IS NULL OR ${memoryEntries.personaId} = ${activePersona.id})`);
    }
    const recentMemories = await db.select().from(memoryEntries)
      .where(and(...memoryConditions))
      .orderBy(desc(memoryEntries.createdAt))
      .limit(5);

    const today = now.toISOString().split("T")[0];
    const todayNote = await this.getDailyNote(today, activePersona?.id);

    return {
      greeting,
      timestamp: now.toISOString(),
      lastConversations: recentConvs.map(c => ({ title: c.title, updatedAt: c.updatedAt })),
      activePersona: activePersona ? { name: activePersona.name, role: activePersona.role } : null,
      recentMemories: recentMemories.map(m => ({ fact: m.fact, category: m.category })),
      todayNotes: todayNote?.content?.slice(0, 300) || null,
    };
  }

  async searchConversations(query: string): Promise<Array<Conversation & { snippet?: string }>> {
    const pattern = `%${query}%`;
    const matchingMessages = await db
      .select({ conversationId: messages.conversationId, content: messages.content })
      .from(messages)
      .where(sql`${messages.content} ILIKE ${pattern}`)
      .orderBy(desc(messages.createdAt));

    const snippetMap = new Map<number, string>();
    for (const row of matchingMessages) {
      if (!snippetMap.has(row.conversationId)) {
        const lowerContent = row.content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const idx = lowerContent.indexOf(lowerQuery);
        if (idx >= 0) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(row.content.length, idx + query.length + 40);
          const snippet = (start > 0 ? "..." : "") + row.content.slice(start, end) + (end < row.content.length ? "..." : "");
          snippetMap.set(row.conversationId, snippet);
        }
      }
    }
    const convIds = [...snippetMap.keys()];

    const titleMatches = await db
      .select()
      .from(conversations)
      .where(sql`${conversations.title} ILIKE ${pattern}`)
      .orderBy(desc(conversations.updatedAt));

    const contentMatches = convIds.length > 0
      ? await db.select().from(conversations).where(inArray(conversations.id, convIds)).orderBy(desc(conversations.updatedAt))
      : [];

    const seen = new Set<number>();
    const results: Array<Conversation & { snippet?: string }> = [];
    for (const c of [...titleMatches, ...contentMatches]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        results.push({ ...c, snippet: snippetMap.get(c.id) });
      }
    }
    return results;
  }

  async getAllDataForExport() {
    const allConversations = await db.select().from(conversations).orderBy(desc(conversations.updatedAt));
    const allMessages = await db.select().from(messages).orderBy(messages.createdAt);
    const allPersonas = await db.select().from(personas);
    const allMemories = await db.select().from(memoryEntries);
    const allKnowledge = await db.select().from(agentKnowledge);
    const allSettings = await db.select().from(agentSettings).limit(1);
    const allSkills = await db.select().from(skills);
    const allDailyNotes = await db.select().from(dailyNotes);
    const allProviderKeys = await db.select().from(providerKeys);
    const allTasks = await db.select().from(heartbeatTasks);
    const allLogs = await db.select().from(heartbeatLogs).orderBy(desc(heartbeatLogs.createdAt)).limit(500);

    const settingsObj = allSettings[0] || null;
    const sanitizedSettings = settingsObj ? {
      ...settingsObj,
      accessPin: settingsObj.accessPin ? "REDACTED" : null,
      discordBotToken: settingsObj.discordBotToken ? "REDACTED" : null,
    } : null;

    return {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      conversations: allConversations,
      messages: allMessages,
      personas: allPersonas,
      memoryEntries: allMemories,
      knowledge: allKnowledge,
      settings: sanitizedSettings,
      skills: allSkills,
      dailyNotes: allDailyNotes,
      providerKeys: allProviderKeys.map(k => ({ ...k, apiKey: "REDACTED" })),
      heartbeatTasks: allTasks,
      heartbeatLogs: allLogs,
    };
  }
}

export const storage = new DatabaseStorage();
