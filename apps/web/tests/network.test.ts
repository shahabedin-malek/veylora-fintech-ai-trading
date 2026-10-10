import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  sepolia,
} from "wagmi/chains";

import {
  ALL_NETWORKS,
  PRACTICE_NETWORKS,
  SUPPORTED_NETWORKS,
  isMainnetChainId,
  isSupportedChainId,
  networkClassForChainId,
  networkModeLabel,
  supportedNetwork,
} from "@/lib/network";

/**
 * Classification is tested directly rather than through the UI: the public chains are
 * real mainnets, the practice chains are sandbox-class (owner-only), and an unknown
 * chain must never resolve to a usable class — there is no fallback mode.
 */

const MAINNET_IDS = [mainnet.id, base.id, arbitrum.id];
const PRACTICE_IDS = [sepolia.id, baseSepolia.id, arbitrumSepolia.id];
const VIEM_CHAINS: Record<string, { id: number }> = {
  mainnet,
  base,
  arbitrum,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
};

describe("network classification", () => {
  it("classifies every public chain as MAINNET", () => {
    for (const id of MAINNET_IDS) {
      expect(networkClassForChainId(id), `chainId ${id}`).toBe("MAINNET");
      expect(isMainnetChainId(id), `chainId ${id}`).toBe(true);
    }
  });

  it("classifies every practice chain as SANDBOX", () => {
    for (const id of PRACTICE_IDS) {
      expect(networkClassForChainId(id), `chainId ${id}`).toBe("SANDBOX");
      expect(isMainnetChainId(id), `chainId ${id}`).toBe(false);
    }
  });

  it("returns null — never a default class — for unknown chains", () => {
    for (const id of [0, -1, 137, 10, 56, 999999]) {
      expect(networkClassForChainId(id), `chainId ${id}`).toBeNull();
      expect(isSupportedChainId(id), `chainId ${id}`).toBe(false);
      expect(supportedNetwork(id), `chainId ${id}`).toBeNull();
    }
  });

  it("exposes a name and a class for every known network, with no duplicates", () => {
    expect(SUPPORTED_NETWORKS.length).toBeGreaterThanOrEqual(2);
    expect(PRACTICE_NETWORKS.length).toBeGreaterThanOrEqual(1);
    for (const network of ALL_NETWORKS) {
      expect(network.name.length, `chainId ${network.chainId} name`).toBeGreaterThan(0);
    }
    for (const network of SUPPORTED_NETWORKS) expect(network.class).toBe("MAINNET");
    for (const network of PRACTICE_NETWORKS) expect(network.class).toBe("SANDBOX");

    const ids = ALL_NETWORKS.map((n) => n.chainId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("labels a public chain as real funds and an unknown one as unsupported", () => {
    const label = networkModeLabel(mainnet.id);
    expect(label).toMatch(/mainnet/i);
    expect(label).toMatch(/real funds/i);
    expect(networkModeLabel(999999)).toMatch(/unsupported/i);
    expect(networkModeLabel(sepolia.id)).toMatch(/practice/i);
  });
});

describe("the offered chains cannot drift from the classification", () => {
  const wagmiSource = readFileSync(join(process.cwd(), "src/lib/wagmi.ts"), "utf8");

  it("offers exactly the chains the classification knows about", () => {
    const referenced = [...wagmiSource.matchAll(/\[(\w+)\.id\]:/g)].map((m) => m[1]);
    expect(referenced.length, "no chain ids found in wagmi.ts (pattern changed?)").toBeGreaterThan(0);

    const referencedIds = [...new Set(referenced)].map((name) => {
      const chain = VIEM_CHAINS[name];
      expect(chain, `wagmi.ts references an unknown chain binding: ${name}`).toBeTruthy();
      return chain.id;
    });

    expect(referencedIds.sort((a, b) => a - b)).toEqual(
      ALL_NETWORKS.map((n) => n.chainId).sort((a, b) => a - b)
    );
  });

  it("routes every chain through the configurable transport, not a bare default", () => {
    const transports = [...wagmiSource.matchAll(/\[(\w+)\.id\]:\s*transportFor\(/g)].map((m) => m[1]);
    expect(transports.length).toBe(ALL_NETWORKS.length);

    const declared = [...wagmiSource.matchAll(/\[(\w+)\.id\]:/g)].map((m) => m[1]);
    expect([...new Set(declared)].sort()).toEqual([...new Set(transports)].sort());
  });
});
