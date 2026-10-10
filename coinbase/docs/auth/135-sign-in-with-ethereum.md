> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Sign In With Ethereum

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

<Tags tags={["EVM", "User Wallet"]} />

## Overview

Sign In With Ethereum (SIWE, [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361)) lets users authenticate using an Ethereum wallet they already own. Instead of a password or OTP, the user signs a structured message with their private key, proving ownership of an address.

This approach is ideal when:

* Your users already have Ethereum wallets (Coinbase Wallet, MetaMask, Phantom, hardware wallets, etc.)
* You want a crypto-native sign-in experience without email or phone number requirements
* You need to tie the user wallet identity to an on-chain address

<Note>
  On first sign-in, CDP can automatically create an embedded user wallet and associate it with the user's Ethereum address. Control this with the `ethereum.createOnLogin` config option (`"eoa"` or `"smart"`). To disable automatic creation and provision wallets manually, omit `createOnLogin` from your config.
</Note>

## How it works

SIWE authentication is a two-step flow:

<AccordionGroup>
  <Accordion title="Step 1: Initiate — request a challenge message">
    Your app calls `signInWithSiwe` with the user's Ethereum address and context about your application. CDP returns a standards-compliant EIP-4361 message containing a cryptographic nonce, expiration time, and the parameters you provided. Present this message to the user's wallet for signing.
  </Accordion>

  <Accordion title="Step 2: Verify — submit the signature">
    After the user signs the message with their wallet, call `verifySiweSignature` with the `flowId` from step 1 and the resulting signature. CDP verifies the signature on-chain, and on success, returns an authenticated user with a user wallet.
  </Accordion>

  <Accordion title="Security features">
    * **Cryptographic proof**: Authentication requires a valid signature from the private key controlling the address — no credential sharing
    * **Replay protection**: Each challenge contains a unique nonce and an expiration time
    * **Domain binding**: The `domain` field ties the signed message to your application, preventing cross-site replay attacks
    * **Rate limiting**: Protection against brute force attempts
  </Accordion>
</AccordionGroup>

## Choosing an integration path

| Path | Best for | Packages |
| - | - | - |
| **[Sign in with Base](#sign-in-with-base)** | Base ecosystem apps that want a one-line "Continue with Base" button | `@coinbase/cdp-react`, `@base-org/account` |
| **[React hooks (custom wallet)](#react-hooks-custom-wallet)** | Apps that already have a wallet connector (wagmi, viem, etc.) | `@coinbase/cdp-hooks` |
| **[Non-React](#non-react)** | Vanilla JS/TS or non-React frameworks | `@coinbase/cdp-core` |

<Tip>
  Try SIWE live at [demo.cdp.coinbase.com](https://demo.cdp.coinbase.com). Enable **Sign in with Base** in the demo's config panel to see `siwe:base` in action alongside email, SMS, and OAuth methods.
</Tip>

## Sign in with Base

**Sign in with Base** is a first-party SIWE auth method for CDP React apps. Add `"siwe:base"` to your `authMethods` config and CDP renders a **Continue with Base** button that handles wallet connection, message signing, and verification automatically.

Under the hood, CDP uses the [Base Account SDK](/coinbase-wallet/overview) (`@base-org/account`) to connect the user's Coinbase Wallet, then runs the standard SIWE flow (`signInWithSiwe` → `personal_sign` → `verifySiweSignature`). The `chainId` is read from the connected wallet at sign-in time.

Unlike OAuth providers, **no CDP Portal configuration is required** — enable the method in your app config and install the Base Account SDK.

### Prerequisites

Install the CDP React packages and the Base Account SDK:

<CodeGroup>
  ```bash npm theme={null}
  npm install @coinbase/cdp-react @coinbase/cdp-hooks @coinbase/cdp-core @base-org/account
  ```

  ```bash pnpm theme={null}
  pnpm add @coinbase/cdp-react @coinbase/cdp-hooks @coinbase/cdp-core @base-org/account
  ```

  ```bash yarn theme={null}
  yarn add @coinbase/cdp-react @coinbase/cdp-hooks @coinbase/cdp-core @base-org/account
  ```
</CodeGroup>

<Warning>
  `@base-org/account` is an optional peer dependency of `@coinbase/cdp-react`. If it is not installed, clicking **Continue with Base** will fail with an error asking you to install the package.
</Warning>

### Enable in your config

Add `"siwe:base"` to the `authMethods` array in your `CDPReactProvider` config. Set `appName` — it is passed to the Base Account SDK during wallet connection.

<CodeGroup>
  ```tsx AuthButton theme={null}
  import { CDPReactProvider, AuthButton, type Config } from "@coinbase/cdp-react";

  const config: Config = {
    projectId: "your-project-id",
    appName: "My App",
    appLogoUrl: "https://picsum.photos/64",
    ethereum: {
      createOnLogin: "smart",
    },
    authMethods: ["email", "siwe:base"],
  };

  function App() {
    return (
      <CDPReactProvider config={config}>
        <AuthButton />
      </CDPReactProvider>
    );
  }
  ```

  ```tsx SignIn modal theme={null}
  import { CDPReactProvider, SignInModal, type Config } from "@coinbase/cdp-react";

  const config: Config = {
    projectId: "your-project-id",
    appName: "My App",
    ethereum: {
      createOnLogin: "smart",
    },
    authMethods: ["email", "sms", "oauth:x", "siwe:base"],
  };

  function App() {
    return (
      <CDPReactProvider config={config}>
        <SignInModal />
      </CDPReactProvider>
    );
  }
  ```
</CodeGroup>

The `authMethods` value uses the `siwe:<provider>` format. Today the supported provider is `"base"` (i.e. `"siwe:base"`). See the [`AuthMethod`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-react/Type-Aliases/AuthMethod) and [`SIWE_METHODS`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-react/Variables/SIWE_METHODS) type references for details.

### Combining with other auth methods

`siwe:base` works alongside email, SMS, and OAuth methods in the same `authMethods` array. Users pick their preferred method from the sign-in UI:

```tsx theme={null}
authMethods: ["email", "sms", "oauth:google", "oauth:x", "siwe:base"],
```

When multiple methods are enabled, `SignInAuthMethodButtons` renders a button for each. Filter methods on individual components with the `authMethods` prop if needed.

## SDK integration

### React hooks (custom wallet)

Use `useSignInWithSiwe` and `useVerifySiweSignature` from `@coinbase/cdp-hooks` when you manage wallet connection yourself (for example, with wagmi or viem). You are responsible for obtaining the user's address, connecting their wallet, and signing the challenge message.

<CodeGroup>
  ```tsx React hooks theme={null}
  import { useSignInWithSiwe, useVerifySiweSignature } from '@coinbase/cdp-hooks';

  function SignInWithEthereum({ walletClient }) {
    const { signInWithSiwe } = useSignInWithSiwe();
    const { verifySiweSignature } = useVerifySiweSignature();

    const handleSignIn = async () => {
      const address = walletClient.account.address;

      // Step 1: Request the challenge message
      const { message, flowId } = await signInWithSiwe({
        address,
        chainId: 8453, // Base mainnet — use the chain the user is signing on
        domain: window.location.hostname,
        uri: window.location.origin,
      });

      // Step 2: Ask the user's wallet to sign the message
      const signature = await walletClient.signMessage({ message });

      // Step 3: Verify the signature and complete sign-in
      const { user, isNewUser } = await verifySiweSignature({ flowId, signature });

      console.log(`Signed in as ${user.userId} (${isNewUser ? 'new' : 'returning'} user)`);
    };

    return <button onClick={handleSignIn}>Sign In With Ethereum</button>;
  }
  ```
</CodeGroup>

<Info>
  The `chainId` must match the network the user's wallet is on. Common values: `8453` (Base mainnet), `84532` (Base Sepolia), `1` (Ethereum mainnet). When using [Sign in with Base](#sign-in-with-base), CDP reads the chain ID from the connected Base wallet automatically.
</Info>

### Non-React

For vanilla JavaScript/TypeScript or other frameworks, import directly from `@coinbase/cdp-core`:

<CodeGroup>
  ```typescript Vanilla JS theme={null}
  import { initialize, signInWithSiwe, verifySiweSignature } from '@coinbase/cdp-core';

  await initialize({ projectId: 'your-project-id' });

  async function signInWithEthereum(walletClient) {
    const address = walletClient.account.address;

    // Step 1: Request the challenge message
    const { message, flowId } = await signInWithSiwe({
      address,
      chainId: 8453,
      domain: window.location.hostname,
      uri: window.location.origin,
    });

    // Step 2: Sign the message with the user's wallet
    const signature = await walletClient.signMessage({ message });

    // Step 3: Verify the signature and complete sign-in
    const { user, isNewUser } = await verifySiweSignature({ flowId, signature });

    console.log(`Signed in as ${user.userId} (${isNewUser ? 'new' : 'returning'} user)`);
  }
  ```
</CodeGroup>

## Auth method linking

Users who are already signed in can link a SIWE address to their account so they can sign in with their external wallet later. Use `useLinkSiwe` from `@coinbase/cdp-hooks` — it follows the same two-step challenge-and-verify flow as `useSignInWithSiwe`, but associates the address with the current session instead of creating a new one.

When a signed-in user clicks **Continue with Base** in CDP React, the SDK automatically calls `linkSiwe` instead of `signInWithSiwe`.

See [Auth Method Linking](/wallets/authentication/auth-method-linking) for the full linking guide and `LinkAuth` component examples.

## Parameters

### `signInWithSiwe` options

| Parameter | Type | Required | Description |
| - | - | - | - |
| `address` | `string` | Yes | ERC-55 checksummed Ethereum address of the user |
| `chainId` | `number` | Yes | EIP-155 chain ID (e.g. `8453` for Base mainnet, `1` for Ethereum mainnet) |
| `domain` | `string` | Yes | RFC 3986 authority of your app (e.g. `"example.com"`) |
| `uri` | `string` | Yes | RFC 3986 URI of the resource being accessed (e.g. `"https://example.com"`) |
| `statement` | `string` | No | Human-readable ASCII assertion shown to the user |
| `resources` | `string[]` | No | Additional URIs the user acknowledges |
| `idempotencyKey` | `string` | No | Safe retry key |

### `signInWithSiwe` result

| Field | Type | Description |
| - | - | - |
| `message` | `string` | EIP-4361-formatted message for the user to sign |
| `flowId` | `string` | Pass this to `verifySiweSignature` |
| `nonce` | `string` | Cryptographic nonce embedded in the message |
| `expirationTime` | `string` | ISO 8601 timestamp after which the challenge expires |

### `verifySiweSignature` options

| Parameter | Type | Required | Description |
| - | - | - | - |
| `flowId` | `string` | Yes | The `flowId` returned by `signInWithSiwe` |
| `signature` | `string` | Yes | ERC-191 hex signature (`0x`-prefixed) from the user's wallet |
| `idempotencyKey` | `string` | No | Safe retry key |

### `verifySiweSignature` result

| Field | Type | Description |
| - | - | - |
| `user` | `User` | The authenticated user object |
| `message` | `string` | Confirmation message |
| `isNewUser` | `boolean` | `true` if this is the user's first sign-in |

## Optional message fields

You can include a `statement` to display a human-readable action the user is approving, and `resources` to enumerate URIs the user acknowledges:

```typescript theme={null}
const { message, flowId } = await signInWithSiwe({
  address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  chainId: 8453,
  domain: 'example.com',
  uri: 'https://example.com',
  statement: 'Sign in to Example App to access your wallet.',
  resources: ['https://example.com/terms', 'https://example.com/privacy'],
});
```

The resulting EIP-4361 message will include these fields, making the user's intent explicit in the signature payload.

## Troubleshooting

<AccordionGroup>
  <Accordion title="Sign in with Base requires @base-org/account">
    Install the Base Account SDK in your project:

    ```bash theme={null}
    npm install @base-org/account
    ```

    This package is an optional peer dependency of `@coinbase/cdp-react` — it is only required when `"siwe:base"` is in your `authMethods`.
  </Accordion>

  <Accordion title="Challenge expired or verification failed">
    The signed message must be submitted to `verifySiweSignature` before the `expirationTime` returned in step 1. If the user takes too long to sign, or the page is left open, request a new challenge by calling `signInWithSiwe` again.
  </Accordion>

  <Accordion title="User rejected the signature request">
    If the user dismisses the wallet signing prompt, the flow fails gracefully. Prompt them to try again — each attempt creates a fresh challenge with a new nonce.
  </Accordion>

  <Accordion title="chainId mismatch">
    The `chainId` passed to `signInWithSiwe` must match the network the user's wallet is connected to. For custom wallet integrations, read the chain ID from the connected provider. For [Sign in with Base](#sign-in-with-base), CDP handles this automatically.
  </Accordion>
</AccordionGroup>

<Warning>
  **Challenge expiration:** The signed message must be submitted to `verifySiweSignature` before the `expirationTime` returned in step 1. Expired challenges will be rejected.
</Warning>

## What to read next

* **[Authentication Methods](/wallets/authentication/overview)**: Overview of all authentication options
* **[Auth Method Linking](/wallets/authentication/auth-method-linking)**: Link SIWE to email, SMS, or OAuth on the same wallet
* **[Implementation Guide](/wallets/authentication/implementation-guide)**: Step-by-step integration patterns with `AuthButton` and hooks
* **[Session Management](/wallets/authentication/session-management)**: Understand session lifecycle and token management
