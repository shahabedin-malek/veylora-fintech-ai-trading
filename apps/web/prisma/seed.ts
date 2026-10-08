import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

async function upsertUser(email: string, name: string, password: string, role: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role, passwordHash: hash(password) },
  });
  await prisma.customer.upsert({
    where: { userId: user.id },
    update: { name, email },
    create: { userId: user.id, name, email },
  });
  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, address: `sim_${user.id.slice(-8).toUpperCase()}`, kind: "SIMULATED", network: "simulated", balanceCents: 0 },
  });
  return user;
}

async function main() {
  const user = await upsertUser("trader@veylora.dev", "Veylora Trader", "password123", "USER");
  const admin = await upsertUser("admin@veylora.dev", "Support Admin", "admin12345", "ADMIN");
  console.log("seeded:", user.email, admin.email);

  // A sample support ticket with a conversation, so the admin console is non-empty.
  const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
  if (customer) {
    const existing = await prisma.ticket.findFirst({ where: { ownerId: user.id } });
    if (!existing) {
      const count = await prisma.ticket.count();
      await prisma.ticket.create({
        data: {
          number: `TCK-${1001 + count}`,
          customerId: customer.id,
          ownerId: user.id,
          assigneeId: admin.id,
          subject: "How do I withdraw simulated funds?",
          status: "PENDING",
          priority: "NORMAL",
          messages: {
            create: [
              { authorId: user.id, body: "Hi — I stopped trading. Where do I withdraw?" },
              { authorId: admin.id, body: "Open Wallet → Withdrawal. You'll see the full simulated breakdown, then confirm.", internal: false },
              { authorId: admin.id, body: "Internal: sample conversation seeded for the walkthrough.", internal: true },
            ],
          },
        },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
