import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const personas = pgTable("personas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("Personal Assistant"),
  icon: text("icon").notNull().default("Bot"),
  isActive: boolean("is_active").notNull().default(false),
  soul: text("soul").notNull().default(""),
  identity: text("identity").notNull().default(""),
  memoryDoc: text("memory_doc").notNull().default(""),
  operatingLoop: text("operating_loop").notNull().default(""),
  heartbeatDoc: text("heartbeat_doc").notNull().default(""),
  toolsDoc: text("tools_doc").notNull().default(""),
  agentsDoc: text("agents_doc").notNull().default(""),
  brandVoiceDoc: text("brand_voice_doc").notNull().default(""),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("New Chat"),
  model: text("model").notNull().default("gpt-5.1"),
  thinking: boolean("thinking").notNull().default(false),
  personaId: integer("persona_id").references(() => personas.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const memoryEntries = pgTable("memory_entries", {
  id: serial("id").primaryKey(),
  fact: text("fact").notNull(),
  category: text("category").notNull().default("preference"),
  source: text("source").notNull().default("conversation"),
  status: text("status").notNull().default("active"),
  personaId: integer("persona_id").references(() => personas.id, { onDelete: "set null" }),
  accessCount: integer("access_count").notNull().default(0),
  embedding: jsonb("embedding"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastAccessed: timestamp("last_accessed").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const dailyNotes = pgTable("daily_notes", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  content: text("content").notNull(),
  personaId: integer("persona_id").references(() => personas.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const agentSettings = pgTable("agent_settings", {
  id: serial("id").primaryKey(),
  agentName: text("agent_name").notNull().default("VisionClaw"),
  personality: text("personality").notNull().default("You are VisionClaw, a helpful personal AI assistant."),
  defaultModel: text("default_model").notNull().default("gpt-5.1"),
  thinkingEnabled: boolean("thinking_enabled").notNull().default(false),
  discordBotToken: text("discord_bot_token"),
  accessPin: text("access_pin"),
});

export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("Zap"),
  enabled: boolean("enabled").notNull().default(true),
  category: text("category").notNull().default("general"),
  promptContent: text("prompt_content"),
});

export const providerKeys = pgTable("provider_keys", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(),
  apiKey: text("api_key").notNull(),
  baseUrl: text("base_url"),
  enabled: boolean("enabled").notNull().default(true),
});

export const agentKnowledge = pgTable("agent_knowledge", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("insight"),
  priority: integer("priority").notNull().default(3),
  personaId: integer("persona_id").references(() => personas.id, { onDelete: "set null" }),
  source: text("source").notNull().default("user"),
  embedding: jsonb("embedding"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const heartbeatTasks = pgTable("heartbeat_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("routine"),
  cronExpression: text("cron_expression").notNull().default("*/30 * * * *"),
  enabled: boolean("enabled").notNull().default(true),
  promptContent: text("prompt_content").notNull(),
  model: text("model").notNull().default("gpt-5-nano"),
  personaId: integer("persona_id").references(() => personas.id, { onDelete: "set null" }),
  createdBy: text("created_by").notNull().default("user"),
  parentTaskId: integer("parent_task_id"),
  runOnce: boolean("run_once").notNull().default(false),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const heartbeatLogs = pgTable("heartbeat_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id"),
  taskName: text("task_name").notNull(),
  status: text("status").notNull().default("success"),
  input: text("input"),
  output: text("output"),
  model: text("model"),
  personaId: integer("persona_id"),
  personaName: text("persona_name"),
  delegatedTasks: text("delegated_tasks"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPersonaSchema = createInsertSchema(personas).omit({ id: true, createdAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertMemoryEntrySchema = createInsertSchema(memoryEntries).omit({ id: true, createdAt: true, lastAccessed: true });
export const insertDailyNoteSchema = createInsertSchema(dailyNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSettingsSchema = createInsertSchema(agentSettings).omit({ id: true });
export const insertSkillSchema = createInsertSchema(skills).omit({ id: true });
export const insertProviderKeySchema = createInsertSchema(providerKeys).omit({ id: true });
export const insertKnowledgeSchema = createInsertSchema(agentKnowledge).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHeartbeatTaskSchema = createInsertSchema(heartbeatTasks).omit({ id: true, createdAt: true, lastRunAt: true, nextRunAt: true });
export const insertHeartbeatLogSchema = createInsertSchema(heartbeatLogs).omit({ id: true, createdAt: true });

export const conversationTemplates = pgTable("conversation_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("MessageSquare"),
  category: text("category").notNull().default("general"),
  personaId: integer("persona_id").references(() => personas.id, { onDelete: "set null" }),
  model: text("model"),
  systemPromptPrefix: text("system_prompt_prefix"),
  starterMessages: text("starter_messages").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationTemplateSchema = createInsertSchema(conversationTemplates).omit({ id: true, createdAt: true });

export type Persona = typeof personas.$inferSelect;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type InsertMemoryEntry = z.infer<typeof insertMemoryEntrySchema>;
export type DailyNote = typeof dailyNotes.$inferSelect;
export type InsertDailyNote = z.infer<typeof insertDailyNoteSchema>;
export type AgentSettings = typeof agentSettings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Skill = typeof skills.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type ProviderKey = typeof providerKeys.$inferSelect;
export type InsertProviderKey = z.infer<typeof insertProviderKeySchema>;
export type AgentKnowledge = typeof agentKnowledge.$inferSelect;
export type InsertKnowledge = z.infer<typeof insertKnowledgeSchema>;
export type HeartbeatTask = typeof heartbeatTasks.$inferSelect;
export type InsertHeartbeatTask = z.infer<typeof insertHeartbeatTaskSchema>;
export type HeartbeatLog = typeof heartbeatLogs.$inferSelect;
export type InsertHeartbeatLog = z.infer<typeof insertHeartbeatLogSchema>;
export type ConversationTemplate = typeof conversationTemplates.$inferSelect;
export type InsertConversationTemplate = z.infer<typeof insertConversationTemplateSchema>;

export const users = pgTable("users", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
