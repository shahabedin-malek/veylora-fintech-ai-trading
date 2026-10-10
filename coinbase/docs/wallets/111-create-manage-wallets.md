> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Create & Manage Wallets

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

## Account types

CDP Wallets support three account types:

* **EOA** - Standard EVM account controlled by a private key. Supports all EVM networks. Best for simple transfers, signing, and broad network coverage.
* **Smart Account** - Programmable EVM account ([ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)) that enables gas sponsorship, batched transactions, and spend permissions. Supported on Base, Ethereum, Arbitrum, Optimism, Polygon, BNB, Avalanche, and Zora. Requires an EOA as its owner.
* **Solana** - Native Solana account. Supported on Mainnet and Devnet.

## Create a user wallet

User wallets are owned by your end users. Users can sign in with email, SMS, social login, or a JWT from your existing authentication system, and retain full custody of their assets. Your backend can also pre-generate wallets before a user signs in for a seamless first-time experience.

<Tabs>
  <Tab title="React">
    Configure `createOnLogin` to create an account automatically when the user signs in. Use `"eoa"` for a standard account or `"smart"` for a Smart Account with gas sponsorship and batching:

    ```tsx theme={null}
    <CDPReactProvider config={{
      projectId: "your-project-id",
      ethereum: { createOnLogin: "eoa" }, // or "smart"
      solana: { createOnLogin: true },
    }}>
    ```

    To create additional accounts after the user signs in:

    ```tsx theme={null}
    import { useCreateEvmEoaAccount, useCreateSolanaAccount } from "@coinbase/cdp-hooks";

    const { createEvmEoaAccount } = useCreateEvmEoaAccount();
    const { createSolanaAccount } = useCreateSolanaAccount();

    const evmAccount = await createEvmEoaAccount();
    const solAccount = await createSolanaAccount();
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    Pre-generate user wallets on your backend so you can fund them before users sign in:

    ```typescript theme={null}
    const endUser = await cdp.endUser.createEndUser({
      authenticationMethods: [
        { type: "email", email: "user@example.com" }
      ],
      evmAccount: { createSmartAccount: false },
      solanaAccount: { createSmartAccount: false },
    });

    console.log("EVM:", endUser.evmAccounts?.[0]);
    console.log("Solana:", endUser.solanaAccounts?.[0]);
    ```

    Supported authentication methods are `email`, `sms` (with `phoneNumber`), and `jwt` (with `sub` and `kid`). To connect your existing authentication system, see [Custom Authentication](/wallets/authentication/custom-authentication).

    After you pre-generate a wallet, users can sign in to it from your application with `@coinbase/cdp-react` or `@coinbase/cdp-hooks`. The following React example uses email authentication.

    <Accordion title="Sign in to a pre-generated wallet from your React app">
      Sign in with the same authentication identifier used when you created the end user. For example, use the same email address below. Omit `createOnLogin` because the backend has already created the accounts.

      ```tsx theme={null}
      import { useState } from "react";
      import { CDPReactProvider } from "@coinbase/cdp-react";
      import { useSignInWithEmail, useVerifyEmailOTP } from "@coinbase/cdp-hooks";

      const config = {
        projectId: "your-project-id",
      };

      function SignIn() {
        const [email, setEmail] = useState("");
        const [otp, setOtp] = useState("");
        const [flowId, setFlowId] = useState<string>();
        const [addresses, setAddresses] = useState<{
          evm?: string;
          solana?: string;
        }>({});
        const { signInWithEmail } = useSignInWithEmail();
        const { verifyEmailOTP } = useVerifyEmailOTP();

        async function startSignIn() {
          const { flowId } = await signInWithEmail({ email });
          setFlowId(flowId);
        }

        async function verifyOtp() {
          if (!flowId) return;

          const { user } = await verifyEmailOTP({ flowId, otp });
          setAddresses({
            evm: user.evmAccountObjects?.[0]?.address,
            solana: user.solanaAccountObjects?.[0]?.address,
          });
        }

        return (
          <>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="user@example.com"
            />
            <button onClick={startSignIn}>Send verification code</button>

            <input
              value={otp}
              onChange={event => setOtp(event.target.value)}
              placeholder="Six-digit code"
            />
            <button onClick={verifyOtp}>Sign in</button>

            {addresses.evm && <p>EVM: {addresses.evm}</p>}
            {addresses.solana && <p>Solana: {addresses.solana}</p>}
          </>
        );
      }

      export default function App() {
        return (
          <CDPReactProvider config={config}>
            <SignIn />
          </CDPReactProvider>
        );
      }
      ```

      After the user verifies the one-time password, the frontend SDK returns the existing end user and their pre-generated account addresses.
    </Accordion>
  </Tab>

  <Tab title="Python">
    Pre-generate wallets on your backend before users sign in, so you can fund them with assets upfront:

    ```python theme={null}
    from cdp.openapi_client.models.authentication_method import AuthenticationMethod
    from cdp.openapi_client.models.email_authentication import EmailAuthentication
    from cdp.openapi_client.models.create_end_user_request_evm_account import CreateEndUserRequestEvmAccount
    from cdp.openapi_client.models.create_end_user_request_solana_account import CreateEndUserRequestSolanaAccount

    end_user = await cdp.end_user.create_end_user(
        authentication_methods=[
            AuthenticationMethod(EmailAuthentication(type="email", email="user@example.com"))
        ],
        evm_account=CreateEndUserRequestEvmAccount(create_smart_account=False),
        solana_account=CreateEndUserRequestSolanaAccount(create_smart_account=False),
    )
    ```

    Supported authentication methods are `email`, `sms` (with `phoneNumber`), and `jwt` (with `sub` and `kid`). To connect your existing authentication system, see [Custom Authentication](/wallets/authentication/custom-authentication).
  </Tab>
</Tabs>

### Multiple accounts per user

Each end user can have up to 10 EVM EOAs, 10 Smart Accounts, and 10 Solana accounts. One account of each configured type is created automatically via `createOnLogin`. To add more:

```tsx React theme={null}
import {
  useCreateEvmEoaAccount,
  useCreateEvmSmartAccount,
  useCreateSolanaAccount,
  useCurrentUser,
} from "@coinbase/cdp-hooks";

const { createEvmEoaAccount } = useCreateEvmEoaAccount();
const { createEvmSmartAccount } = useCreateEvmSmartAccount();
const { createSolanaAccount } = useCreateSolanaAccount();
const { currentUser } = useCurrentUser();

// Add another EVM EOA
const eoa = await createEvmEoaAccount();

// Add a Smart Account (needs an EOA owner)
const ownerAddress = currentUser?.evmAccountObjects?.[0]?.address;
const smart = await createEvmSmartAccount({ ownerAddress });

// Add a Solana account
const sol = await createSolanaAccount();
```

<Note>
  Each Smart Account requires a unique EOA owner. You cannot create multiple Smart Accounts with the same EOA.
</Note>

## Create an API key wallet

API key wallets are owned and controlled by your server. Your backend creates and manages accounts using your CDP API key and Wallet Secret.

### EVM EOA

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const account = await cdp.evm.createAccount();
    console.log("Address:", account.address);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    account = await cdp.evm.create_account()
    print(f"Address: {account.address}")
    ```
  </Tab>
</Tabs>

### EVM Smart Account

A Smart Account is an ERC-4337 account owned by an EOA. Each EOA can own one Smart Account. Use `getOrCreateSmartAccount` to also assign a name for easier retrieval later.

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const owner = await cdp.evm.getOrCreateAccount({ name: "my-owner" });

    // Create a Smart Account
    const smartAccount = await cdp.evm.createSmartAccount({ owner });
    console.log("Smart Account:", smartAccount.address);

    // Create or retrieve a named Smart Account with a different EOA owner
    const namedOwner = await cdp.evm.getOrCreateAccount({
      name: "my-named-owner",
    });
    const named = await cdp.evm.getOrCreateSmartAccount({
      name: "my-smart-account",
      owner: namedOwner,
    });
    console.log("Named Smart Account:", named.address);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    owner = await cdp.evm.get_or_create_account(name="my-owner")

    # Create a Smart Account
    smart_account = await cdp.evm.create_smart_account(owner=owner)
    print(f"Smart Account: {smart_account.address}")

    # Create or retrieve a named Smart Account with a different EOA owner
    named_owner = await cdp.evm.get_or_create_account(name="my-named-owner")
    named = await cdp.evm.get_or_create_smart_account(
        name="my-smart-account",
        owner=named_owner,
    )
    print(f"Named Smart Account: {named.address}")
    ```
  </Tab>
</Tabs>

### Solana

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const account = await cdp.solana.createAccount();
    console.log("Address:", account.address);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    account = await cdp.solana.create_account()
    print(f"Address: {account.address}")
    ```
  </Tab>
</Tabs>

### Named accounts

Assign a human-readable name for easier retrieval of wallets created with API keys. Names must be 2-36 alphanumeric characters or hyphens, and unique per account type within a project. `getOrCreateAccount` creates the account if it doesn't exist, or returns the existing one:

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const account = await cdp.evm.getOrCreateAccount({ name: "treasury" });
    const solAccount = await cdp.solana.getOrCreateAccount({ name: "sol-treasury" });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    account = await cdp.evm.get_or_create_account(name="treasury")
    sol_account = await cdp.solana.get_or_create_account(name="sol-treasury")
    ```
  </Tab>
</Tabs>

## Manage accounts

### Get an account

For user authentication, accounts are available on the current user object. For API key authentication, retrieve accounts by address or name.

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useCurrentUser } from "@coinbase/cdp-hooks";

    const { currentUser } = useCurrentUser();

    // All EVM EOAs
    const evmAccounts = currentUser?.evmAccountObjects;
    // All Smart Accounts
    const smartAccounts = currentUser?.evmSmartAccountObjects;
    // All Solana accounts
    const solanaAccounts = currentUser?.solanaAccountObjects;
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    // By address
    const account = await cdp.evm.getAccount({
      address: "0x1234...5678"
    });

    // By name
    const named = await cdp.evm.getAccount({ name: "treasury" });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    # By address
    account = await cdp.evm.get_account(address="0x1234...5678")

    # By name
    named = await cdp.evm.get_account(name="treasury")
    ```
  </Tab>
</Tabs>

### List accounts

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    let response = await cdp.evm.listAccounts();

    while (true) {
      for (const account of response.accounts) {
        console.log(account.address);
      }
      if (!response.nextPageToken) break;
      response = await cdp.evm.listAccounts({ pageToken: response.nextPageToken });
    }
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    response = await cdp.evm.list_accounts()

    while True:
        for account in response.accounts:
            print(account.address)
        if not response.next_page_token:
            break
        response = await cdp.evm.list_accounts(page_token=response.next_page_token)
    ```
  </Tab>
</Tabs>

### Update an account

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    // Rename
    const updated = await cdp.evm.updateAccount({
      address: account.address,
      update: { name: "new-name" },
    });

    // Attach a policy
    const withPolicy = await cdp.evm.updateAccount({
      address: account.address,
      update: { accountPolicy: "policy-id" },
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    from cdp import UpdateAccountOptions

    # Rename
    updated = await cdp.evm.update_account(
        address=account.address,
        update=UpdateAccountOptions(name="new-name"),
    )

    # Attach a policy
    with_policy = await cdp.evm.update_account(
        address=account.address,
        update=UpdateAccountOptions(account_policy="policy-id"),
    )
    ```
  </Tab>
</Tabs>

## Token balances

Retrieve balances for native tokens (ETH, SOL) and ERC-20 / SPL tokens on any supported network. Balance queries are read-only and work for any public address, not just accounts you own.

### EVM

Supported networks: `ethereum`, `base`, `base-sepolia`.

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    let page = await cdp.evm.listTokenBalances({
      address: account.address,
      network: "base-sepolia",
      pageSize: 10,
    });

    while (true) {
      for (const balance of page.balances) {
        console.log(balance.token.contractAddress, balance.amount.amount);
      }
      if (!page.nextPageToken) break;
      page = await cdp.evm.listTokenBalances({
        address: account.address,
        network: "base-sepolia",
        pageSize: 10,
        pageToken: page.nextPageToken,
      });
    }
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    page = await cdp.evm.list_token_balances(
        address=account.address,
        network="base-sepolia",
        page_size=10,
    )

    while True:
        for balance in page.balances:
            print(balance.token.contract_address, balance.amount.amount)
        if not page.next_page_token:
            break
        page = await cdp.evm.list_token_balances(
            address=account.address,
            network="base-sepolia",
            page_size=10,
            page_token=page.next_page_token,
        )
    ```
  </Tab>
</Tabs>

### Solana

Supported networks: `solana`, `solana-devnet`.

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    let page = await cdp.solana.listTokenBalances({
      address: account.address,
      network: "solana-devnet",
      pageSize: 10,
    });

    while (true) {
      for (const balance of page.balances) {
        console.log(balance.token.mintAddress, balance.amount.amount);
      }
      if (!page.nextPageToken) break;
      page = await cdp.solana.listTokenBalances({
        address: account.address,
        network: "solana-devnet",
        pageSize: 10,
        pageToken: page.nextPageToken,
      });
    }
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    page = await cdp.solana.list_token_balances(
        address=account.address,
        network="solana-devnet",
        page_size=10,
    )

    while True:
        for balance in page.balances:
            print(balance.token.mint_address, balance.amount.amount)
        if not page.next_page_token:
            break
        page = await cdp.solana.list_token_balances(
            address=account.address,
            network="solana-devnet",
            page_size=10,
            page_token=page.next_page_token,
        )
    ```
  </Tab>
</Tabs>
