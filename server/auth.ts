import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { storage } from "./storage";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.warn("[auth] WARNING: SESSION_SECRET not set. Using random secret (sessions will not survive restarts).");
}
const EFFECTIVE_SECRET = SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const PIN_SALT = "visionclaw-pin-v1";
const activeSessions = new Map<string, { createdAt: number }>();
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

function hashPin(pin: string): string {
  return crypto.createHmac("sha256", PIN_SALT).update(pin).digest("hex");
}

function hashPinLegacy(pin: string): string {
  return crypto.createHmac("sha256", EFFECTIVE_SECRET).update(pin).digest("hex");
}

function verifyPin(pin: string, storedHash: string): boolean {
  if (hashPin(pin) === storedHash) return true;
  if (hashPinLegacy(pin) === storedHash) return true;
  return false;
}

export function isValidSession(token: string): boolean {
  if (!token || !activeSessions.has(token)) return false;
  const session = activeSessions.get(token)!;
  if (Date.now() - session.createdAt > SESSION_MAX_AGE) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/api/auth/login" || req.path === "/api/auth/status" || req.path === "/api/health") {
    return next();
  }

  const settings = await storage.getSettings();
  if (!settings?.accessPin) {
    return next();
  }

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: "Authentication required", needsAuth: true });
  }

  const session = activeSessions.get(token)!;
  if (Date.now() - session.createdAt > SESSION_MAX_AGE) {
    activeSessions.delete(token);
    return res.status(401).json({ error: "Session expired", needsAuth: true });
  }

  next();
}

export async function handleLogin(req: Request, res: Response) {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const attempt = loginAttempts.get(clientIp);
  if (attempt && attempt.count >= MAX_LOGIN_ATTEMPTS) {
    const elapsed = Date.now() - attempt.lastAttempt;
    if (elapsed < LOGIN_LOCKOUT_MS) {
      const remainMin = Math.ceil((LOGIN_LOCKOUT_MS - elapsed) / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${remainMin} minutes.` });
    }
    loginAttempts.delete(clientIp);
  }

  const { pin } = req.body;
  if (!pin || typeof pin !== "string") {
    return res.status(400).json({ error: "PIN required" });
  }

  const settings = await storage.getSettings();
  if (!settings?.accessPin) {
    return res.status(400).json({ error: "No PIN configured" });
  }

  if (!verifyPin(pin, settings.accessPin)) {
    const current = loginAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
    loginAttempts.set(clientIp, { count: current.count + 1, lastAttempt: Date.now() });
    return res.status(403).json({ error: "Invalid PIN" });
  }

  loginAttempts.delete(clientIp);
  const token = generateSessionToken();
  activeSessions.set(token, { createdAt: Date.now() });

  res.json({ token, expiresIn: SESSION_MAX_AGE });
}

export async function handleAuthStatus(_req: Request, res: Response) {
  const settings = await storage.getSettings();
  res.json({
    authRequired: !!settings?.accessPin,
    configured: !!settings?.accessPin,
  });
}

export async function setAccessPin(pin: string): Promise<string> {
  return hashPin(pin);
}

export function clearExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeSessions) {
    if (now - session.createdAt > SESSION_MAX_AGE) {
      activeSessions.delete(token);
    }
  }
}

export function clearAllSessions() {
  activeSessions.clear();
}
