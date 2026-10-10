"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { credentialEncryptionAvailable, encryptSecret, fingerprintOf } from "@/lib/credentials/crypto";
import { warmCredentialCache } from "@/lib/credentials/pool";
import { providerDef } from "@/lib/credentials/providers";
import { smokeProviders } from "@/lib/credentials/smoke";
import { prisma } from "@/lib/db";

/**
 * Admin actions for the provider key pool.
 *
 * A key is encrypted the moment it is submitted and **never** returned, rendered or
 * logged; only a non-reversible fingerprint round-trips to the UI. Every mutation is
 * audited (provider and label only — never a value). Admin-only, like every other
 * operator surface.
 */

const CREDENTIALS = "/admin/credentials";

function refresh(provider?: string): void {
  revalidatePath(CREDENTIALS);
  if (provider) void warmCredentialCache([provider]);
}

export async function addProviderCredentialAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const provider = String(formData.get("provider") ?? "").trim();
  const def = providerDef(provider);
  if (!def) redirect(`${CREDENTIALS}?keys=badprovider`);
  if (!credentialEncryptionAvailable()) redirect(`${CREDENTIALS}?keys=no-key`);

  const values: Record<string, string> = {};
  for (const field of def.fields) {
    const value = String(formData.get(`field:${field.key}`) ?? "").trim();
    if (!value) {
      if (field.optional) continue;
      redirect(`${CREDENTIALS}?keys=missing&provider=${encodeURIComponent(provider)}`);
    }
    values[field.key] = value;
  }

  const label = String(formData.get("label") ?? "").trim() || `key-${Date.now()}`;
  const priorityRaw = Number.parseInt(String(formData.get("priority") ?? ""), 10);
  const priority = Number.isFinite(priorityRaw) ? priorityRaw : 100;

  await prisma.providerCredential.create({
    data: {
      provider,
      label,
      secret: encryptSecret(values),
      fingerprint: fingerprintOf(values),
      priority,
      enabled: true,
      status: "ACTIVE",
      createdById: admin.id,
    },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "provider-credential.added", subject: provider, detail: label },
  });

  refresh(provider);
  redirect(`${CREDENTIALS}?keys=added`);
}

export async function toggleProviderCredentialAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.providerCredential.findUnique({ where: { id } });
  if (!row) redirect(`${CREDENTIALS}?keys=missing-row`);

  const enabled = !row.enabled;
  await prisma.providerCredential.update({
    where: { id },
    data: enabled
      ? { enabled: true, status: "ACTIVE", failureCount: 0, cooldownUntil: null, lastError: null }
      : { enabled: false, status: "DISABLED" },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: enabled ? "provider-credential.enabled" : "provider-credential.disabled",
      subject: row.provider,
      detail: row.label,
    },
  });

  refresh(row.provider);
  redirect(`${CREDENTIALS}?keys=toggled`);
}

export async function deleteProviderCredentialAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.providerCredential.findUnique({ where: { id } });
  if (!row) redirect(`${CREDENTIALS}?keys=missing-row`);

  await prisma.providerCredential.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "provider-credential.deleted", subject: row.provider, detail: row.label },
  });

  refresh(row.provider);
  redirect(`${CREDENTIALS}?keys=deleted`);
}

export async function smokeProviderKeysAction(): Promise<void> {
  const admin = await requireAdmin();
  await smokeProviders();
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "provider-credential.smoked", subject: "all" },
  });
  revalidatePath(CREDENTIALS);
  redirect(`${CREDENTIALS}?keys=smoked`);
}
