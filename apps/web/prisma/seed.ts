import { PrismaClient } from "@prisma/client";
import { SEEDED_ACCOUNTS, SEEDED_CHAIN_ID, type SeededAccount } from "./seed-accounts";

const prisma = new PrismaClient();

/**
 * Seeds the deterministic accounts and a sample support conversation.
 *
 * Accounts are wallet addresses (no email or password). Re-runnable: every write
 * is an upsert on a stable key.
 */
async function upsertAccount(account: SeededAccount) {
  const user = await prisma.user.upsert({
    where: { walletAddress: account.address },
    update: { name: account.name, role: account.role, chainId: SEEDED_CHAIN_ID },
    create: {
      id: account.id,
      walletAddress: account.address,
      chainId: SEEDED_CHAIN_ID,
      name: account.name,
      role: account.role,
    },
  });

  await prisma.customer.upsert({
    where: { userId: user.id },
    update: { name: account.name },
    create: { userId: user.id, name: account.name },
  });

  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      address: account.address,
      kind: "MAINNET",
      network: "mainnet",
      balanceCents: 0,
    },
  });

  return user;
}

async function main() {
  const trader = await upsertAccount(SEEDED_ACCOUNTS.trader);
  const admin = await upsertAccount(SEEDED_ACCOUNTS.admin);
  console.log("seeded:", trader.walletAddress, admin.walletAddress);

  // A sample support ticket with a conversation, so the admin console is non-empty.
  const customer = await prisma.customer.findUnique({ where: { userId: trader.id } });
  if (customer) {
    const existing = await prisma.ticket.findFirst({ where: { ownerId: trader.id } });
    if (!existing) {
      const count = await prisma.ticket.count();
      await prisma.ticket.create({
        data: {
          number: `TCK-${1001 + count}`,
          customerId: customer.id,
          ownerId: trader.id,
          assigneeId: admin.id,
          subject: "How do I withdraw funds?",
          status: "PENDING",
          priority: "NORMAL",
          messages: {
            create: [
              { authorId: trader.id, body: "Hi — I stopped trading. Where do I withdraw?" },
              {
                authorId: admin.id,
                body: "Open Wallet → Withdrawal. You'll see the full breakdown (balance, fee, total), then confirm.",
                internal: false,
              },
              {
                authorId: admin.id,
                body: "Internal: sample conversation seeded for the walkthrough.",
                internal: true,
              },
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
