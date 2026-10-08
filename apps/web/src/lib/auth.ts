import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const id = await getCurrentUserId();
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true } });
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
