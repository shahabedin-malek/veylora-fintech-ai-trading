> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Quickstart: User Wallet

export const TypeScriptConfigRequirement = () => {
  return <>
      <Note>
        <strong>TypeScript users:</strong> Set <code>moduleResolution: "node16"</code> or <code>"nodenext"</code> in your <code>tsconfig.json</code> (not the legacy <code>"node"</code>) to avoid compilation errors with the CDP SDK.
      </Note>
    </>;
};

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

<Tags tags={["EVM", "Solana", "User Wallet"]} />

## Overview

This guide shows how to add user wallets to your existing React app with just a few lines of code. Users sign in with email, SMS, or social login and get a self-custodial wallet instantly, with no seed phrases required.

<Tip>
  Check out the [CDP Web SDK reference](/sdks/cdp-sdks-v2/frontend) for comprehensive method signatures, types, and examples.
</Tip>

<Note>
  **Already have user authentication?** If you're using Auth0, Firebase, AWS Cognito, or another identity provider, use [Custom Authentication](/wallets/authentication/custom-authentication) to pass JWTs from your existing auth system to CDP.
</Note>

**Choose your path:**

<CardGroup cols={2}>
  <Card title="Integrate into your app" icon="code" href="#1-install-packages">
    Continue reading to add user wallets to your current React app with a few lines of code.
  </Card>

  <Card title="Check out our template app" icon="graduation-cap" href="/wallets/demos/demo-app-tutorial">
    Build a complete demo app from scratch to learn all the features.
  </Card>
</CardGroup>

## Prerequisites

* A free [CDP Portal](https://portal.cdp.coinbase.com) account and project. Business verification is not required for non-custodial wallets. When you're ready to use a Coinbase Business account with your CDP integration, [verify your business and go live](/get-started/initial-setup#verify-your-business-and-go-live).
* [Node.js 22+](https://nodejs.org/en/download)
* A node package manager installed (i.e., `npm`, `pnpm`, or `yarn`)
* Basic familiarity with React and TypeScript
* Configured your domain in CDP Portal (see below)

<Accordion title="How to configure your domain in CDP Portal">
  **Step 1: Access CDP Portal**

  Navigate to the [Clients Configuration](https://portal.cdp.coinbase.com/wallets/non-custodial/clients) in CDP Portal, and click **Add domain** to include your local app.

  **Step 2: Add your domain**

  * For local development: Use `http://localhost:3000` (or your preferred port)
  * For production: Use your actual domain (e.g., `https://yourapp.com`)

  <Warning>
    For production apps, only add your actual production domain. Do not add `localhost` to production CDP projects as malicious apps running locally could impersonate your frontend and abuse your project credentials.
  </Warning>

  **Step 3: Save your changes**

  Click **Add domain** again to save your changes. You should see your domain listed in the CDP Portal dashboard. The allowlist will take effect immediately upon saving.

  You should see your domain listed in the CDP Portal dashboard. The allowlist will take effect immediately upon saving.
</Accordion>

<TypeScriptConfigRequirement />

## 1. Install packages

Once you've completed the prerequisites above, install the required packages:

<CodeGroup>
  ```bash npm theme={null}
  npm install @coinbase/cdp-react @coinbase/cdp-core @coinbase/cdp-hooks
  ```

  ```bash pnpm theme={null}
  pnpm add @coinbase/cdp-react @coinbase/cdp-core @coinbase/cdp-hooks
  ```

  ```bash yarn theme={null}
  yarn add @coinbase/cdp-react @coinbase/cdp-core @coinbase/cdp-hooks
  ```
</CodeGroup>

## 2. Wrap your app with the provider

Add the CDP provider to your root component (typically `App.tsx` or `main.tsx`). Replace `"your-project-id"` with your actual project ID from [CDP Portal](https://portal.cdp.coinbase.com).

```tsx theme={null}
import { CDPReactProvider } from "@coinbase/cdp-react";

function App() {
  return (
    <CDPReactProvider
      config={{
        projectId: "your-project-id",
        ethereum: { // if you want to create an EVM account on login
          createOnLogin: "eoa" // or "smart" for smart accounts
        },
        solana: { // if you want to create a Solana account on login
          createOnLogin: true
        },
        appName: "Your App Name"
      }}
    >
      <YourExistingApp />
    </CDPReactProvider>
  );
}
```

## 3. Add authentication

### Option A: Use the AuthButton (recommended)

The simplest approach is the `AuthButton` component, which handles the entire authentication flow:

```tsx theme={null}
import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";
import { useIsSignedIn } from "@coinbase/cdp-hooks";

function AuthComponent() {
  const { isSignedIn } = useIsSignedIn();

  return (
    <div>
      {isSignedIn ? (
        <div>Welcome! You're signed in.</div>
      ) : (
        <div>
          <h2>Please sign in</h2>
          <AuthButton />
        </div>
      )}
    </div>
  );
}
```

### Option B: Build custom auth UI

For custom UIs, use the authentication hooks directly:

```tsx theme={null}
function CustomAuthComponent() {
  const { signInWithEmail } = useSignInWithEmail();
  const { verifyEmailOTP } = useVerifyEmailOTP();
  const { isSignedIn } = useIsSignedIn();
  const [flowId, setFlowId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const handleEmailSubmit = async () => {
    if (!email) return;
    const result = await signInWithEmail({ email });
    setFlowId(result.flowId);
  };

  const handleOtpSubmit = async () => {
    if (!flowId || !otp) return;
    const { user } = await verifyEmailOTP({ flowId, otp });
    console.log("Signed in!", user.evmAccounts?.[0]);
  };

  if (isSignedIn) return <div>Welcome! You're signed in.</div>;

  return (
    <div>
      {flowId ? (
        <div>
          <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter OTP code" />
          <button onClick={handleOtpSubmit}>Verify OTP</button>
        </div>
      ) : (
        <div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" />
          <button onClick={handleEmailSubmit}>Send OTP</button>
        </div>
      )}
    </div>
  );
}
```

## 4. Send transactions

### EVM

Once authenticated, users automatically get a wallet address. Here's how to send EVM transactions:

```tsx theme={null}
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { SendEvmTransactionButton } from "@coinbase/cdp-react";

function SendTransaction() {
  const { evmAddress } = useEvmAddress();

  return (
    <div>
      {evmAddress ? (
        <SendEvmTransactionButton
          account={evmAddress}
          network="base-sepolia"
          transaction={{
            to: evmAddress,
            value: 1000000000000n,
            chainId: 84532,
            type: "eip1559",
          }}
          onSuccess={(hash) => console.log("Transaction sent:", hash)}
          onError={(error) => console.error("Transaction failed:", error)}
          pendingLabel="Sending..."
        />
      ) : (
        <p>Wallet not ready yet...</p>
      )}
    </div>
  );
}
```

### Solana

```tsx theme={null}
import { useSolanaAddress } from "@coinbase/cdp-hooks";
import { SendSolanaTransactionButton } from "@coinbase/cdp-react";

function SendTransaction() {
  const { solanaAddress } = useSolanaAddress();

  return (
    <div>
      {solanaAddress ? (
        <SendSolanaTransactionButton
          account={solanaAddress}
          network="solana-devnet"
          transaction="base64-solana-transaction"
          pendingLabel="Sending..."
        />
      ) : (
        <p>Wallet not ready yet...</p>
      )}
    </div>
  );
}
```

<Tip>
  **Need testnet funds?** Get free Base Sepolia ETH from the [CDP Faucet](https://portal.cdp.coinbase.com/products/faucet).
</Tip>

## What to read next

<CardGroup cols={2}>
  <Card title="Demo app tutorial" icon="graduation-cap" href="/wallets/demos/demo-app-tutorial">
    Build a complete demo app to learn all features in depth
  </Card>

  <Card title="React Hooks" icon="code" href="/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks">
    Explore all available hooks for advanced functionality
  </Card>

  <Card title="React Components" icon="puzzle-piece" href="/wallets/client-side-development/react-components">
    Use pre-built components for faster development
  </Card>

  <Card title="Authentication Methods" icon="key" href="/wallets/authentication/overview">
    Email OTP, SMS, social login, and custom auth options
  </Card>
</CardGroup>
