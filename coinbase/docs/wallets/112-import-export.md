> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Import & Export

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

All import and export operations are end-to-end encrypted between the CDP SDKs and the [TEE](/wallets/security-and-policies/security-overview#tee-architecture). Keys are never exposed outside the secure enclave during transfer.

## Import Wallets

Only individual private key import is supported. To import an HD wallet, derive individual keys from the seed and import them one at a time.

### Import user wallets

Use `importEndUser` to import a private key into an end user's wallet. The end user controls the wallet through your app's authentication flow. This is useful when migrating users from another wallet provider and you want to preserve their wallet addresses.

Set `keyType` to `"evm"` (hex-encoded) or `"solana"` (base58-encoded).

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const endUser = await cdp.endUser.importEndUser({
      authenticationMethods: [
        { type: "email", email: "user@example.com" }
      ],
      privateKey: "0x1234567890abcdef...",
      keyType: "evm",
    });

    console.log("EVM accounts:", endUser.evmAccountObjects);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    from cdp.openapi_client.models.authentication_method import AuthenticationMethod
    from cdp.openapi_client.models.email_authentication import EmailAuthentication

    end_user = await cdp.end_user.import_end_user(
        authentication_methods=[
            AuthenticationMethod(EmailAuthentication(type="email", email="user@example.com"))
        ],
        private_key="0x1234567890abcdef...",
        key_type="evm",
    )
    ```
  </Tab>
</Tabs>

SMS and JWT authentication methods are also supported. See [Authentication](/wallets/authentication/overview) for details.

### Import API key wallets

#### EVM

Use `importAccount` to bring an external private key into a wallet your application controls via API key. Provide a hex-encoded 32-byte private key.

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const account = await cdp.evm.importAccount({
      privateKey: "0x0123456789abcdef...",
      name: "imported-evm",
    });
    console.log("Imported:", account.address);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    account = await cdp.evm.import_account(
        private_key="0x0123456789abcdef...",
        name="imported-evm",
    )
    print(f"Imported: {account.address}")
    ```
  </Tab>
</Tabs>

#### Solana

Provide a base58-encoded private key (e.g. from Phantom) or a raw 32-byte key array.

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    // Base58-encoded key
    const account = await cdp.solana.importAccount({
      privateKey: "4YFq9y5f5hi77Bq8kDCE6VgqoAq...",
      name: "imported-solana",
    });

    // Or raw 32-byte array
    const fromBytes = await cdp.solana.importAccount({
      privateKey: keypair.secretKey.subarray(0, 32),
      name: "imported-solana-bytes",
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    # Base58-encoded key
    account = await cdp.solana.import_account(
        private_key="4YFq9y5f5hi77Bq8kDCE6VgqoAq...",
        name="imported-solana",
    )

    # Or raw 32-byte array
    from_bytes = await cdp.solana.import_account(
        private_key=keypair.secret_key[:32],
        name="imported-solana-bytes",
    )
    ```
  </Tab>
</Tabs>

## Export wallets

<Warning>
  Exporting is a sensitive operation. Store exported keys securely and never log them in plaintext.
</Warning>

### Export user wallets

User wallet exports always happen inside a secure, isolated iframe. Your application code never has access to the raw key material.

#### UI component

The pre-built `ExportWalletModal` from `@coinbase/cdp-react` handles the full export flow with built-in UI:

```tsx React theme={null}
import { useEvmAddress, useSolanaAddress, ExportWalletModal } from "@coinbase/cdp-react";

// EVM export
const EvmExport = () => {
  const { evmAddress } = useEvmAddress();
  if (!evmAddress) return null;
  return <ExportWalletModal address={evmAddress} />;
};

// Solana export
const SolanaExport = () => {
  const { solanaAddress } = useSolanaAddress();
  if (!solanaAddress) return null;
  return <ExportWalletModal address={solanaAddress} />;
};
```

#### React hook

Use [`useEvmKeyExportIframe`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks/Functions/useEvmKeyExportIframe) from `@coinbase/cdp-hooks` when you want to embed the export iframe directly in your own UI:

```tsx React theme={null}
import { useEvmKeyExportIframe, useEvmAddress } from "@coinbase/cdp-hooks";

const EvmKeyExport = () => {
  const { evmAddress } = useEvmAddress();
  const { iframeContainerRef } = useEvmKeyExportIframe({ address: evmAddress });

  if (!evmAddress) return null;

  return (
    <div>
      <p>Your private key will appear below. Store it securely.</p>
      <div ref={iframeContainerRef} />
    </div>
  );
};
```

<Tip>
  **React Native:** It is prohibited to render the export iframe contents directly in a `WebView` as this strips the browser security context that prevents host-app JavaScript from reading iframe contents, which could expose the private key.
  There are two secure alternatives:

  * **Host a web app** that embeds the export iframe and open it in a browser or WebView. This is the preferred option.
  * **JIT-render an HTML wrapper:** dynamically construct a minimal HTML page that embeds the iframe and load it into a `WebView`. This preserves same-origin isolation without requiring a hosted site.
</Tip>

### Export API key wallets

#### EVM

Export private keys from wallets your application controls via API key. You can export by address or by name. Note that you cannot export user wallets via the backend SDKs.

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    // By address
    const privateKey = await cdp.evm.exportAccount({
      address: "0x1234...5678",
    });

    // By name
    const privateKeyByName = await cdp.evm.exportAccount({
      name: "treasury",
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    # By address
    private_key = await cdp.evm.export_account(
        address="0x1234...5678",
    )

    # By name
    private_key_by_name = await cdp.evm.export_account(
        name="treasury",
    )
    ```
  </Tab>
</Tabs>

#### Solana

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    // By address
    const privateKey = await cdp.solana.exportAccount({
      address: "ABC123...",
    });

    // By name
    const privateKeyByName = await cdp.solana.exportAccount({
      name: "sol-treasury",
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    # By address
    private_key = await cdp.solana.export_account(
        address="ABC123...",
    )

    # By name
    private_key_by_name = await cdp.solana.export_account(
        name="sol-treasury",
    )
    ```
  </Tab>
</Tabs>

#### API key configuration

To export private keys programmatically, your API key must have the **Export (export private key)** scope enabled. Configure this when creating the API key under **API restrictions > API-specific restrictions**.

## Security best practices

* Never log, display, or store private keys in plaintext
* Clear key variables from memory after use
* Require explicit user consent before any export operation
* Prefer clipboard copy over displaying keys on screen
* Educate users on secure storage (hardware wallets, encrypted vaults)
