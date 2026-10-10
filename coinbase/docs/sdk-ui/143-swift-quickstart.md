> Coinbase CDP docs — **sdk-ui** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Swift Quickstart

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

<Tags tags={["User Wallet"]} />

## Overview

Use the CDP Swift SDK to add Coinbase Developer Platform (CDP) user wallets to your native iOS and macOS apps.

Your Swift apps can leverage **EVM Externally Owned Accounts (EOA)**, **EVM Smart Accounts**, and **Solana Accounts** through a single library target — **CDPCore** — that exposes an actor-based, async/await API.

<Tip>
  The SDK is distributed as a Swift Package from the public [`coinbase/cdp-swift`](https://github.com/coinbase/cdp-swift) repository. All releases live there.
</Tip>

<Accordion title="What makes Swift user wallets special?">
  The CDP Swift SDK brings the same wallet infrastructure that powers our web and React Native SDKs to native Apple platforms with:

  * **Native performance**: Built for iOS and macOS, no JavaScript bridge.
  * **Async/await first**: `WalletsClient` is an `actor` and every public method is `async`.
  * **Apple platform services**: Keychain-backed session storage, Apple Crypto, and `ASWebAuthenticationSession`-based OAuth are auto-registered on `start()`.
  * **Swappable services**: Replace storage, crypto, or OAuth implementations via `PlatformRegistry` for full control.
</Accordion>

## Prerequisites

* A free [CDP Portal](https://portal.cdp.coinbase.com) account.
* [Xcode 15 or later](https://developer.apple.com/xcode/).
* An iOS Simulator (bundled with Xcode) or a physical iOS/macOS device.

### Minimum version requirements

| | |
| - | - |
| Xcode | 15.0 |
| Swift | 5.9 |
| iOS | 16.0 |
| macOS | 13.0 |

Let's get started by adding the CDP Swift SDK to your project.

## 1. Set up your Swift project

<Steps titleSize="p">
  <Step title="Copy your Project ID">
    Navigate to the [Security Configuration](https://portal.cdp.coinbase.com/wallets/non-custodial/clients) page in CDP Portal and copy your **Project ID**. You will use this in the next step when initializing the SDK.
  </Step>

  <Step title="Add the CDP Swift SDK">
    The SDK is published via Swift Package Manager from the public [`coinbase/cdp-swift`](https://github.com/coinbase/cdp-swift) repository.

    In Xcode, choose **File → Add Package Dependencies…** and enter the repository URL:

    ```
    https://github.com/coinbase/cdp-swift
    ```

    Or add it directly to your `Package.swift`:

    ```swift theme={null}
    // Package.swift
    dependencies: [
        .package(url: "https://github.com/coinbase/cdp-swift", from: "0.1.0"),
    ]
    ```

    Then add the `CDPCore` product to your target:

    ```swift theme={null}
    .target(
        name: "YourApp",
        dependencies: [
            .product(name: "CDPCore", package: "cdp-swift"),
        ]
    )
    ```
  </Step>

  <Step title="Initialize the SDK">
    Create a `WalletsClient`, call `start()` to restore any persisted session and register the default Apple platform services (Keychain, crypto, OAuth), and forward OAuth redirects to `handleOAuthCode(url:)`.

    ```swift theme={null}
    import CDPCore
    import SwiftUI

    @main
    struct MyApp: App {
        @StateObject private var appState = AppState()

        var body: some Scene {
            WindowGroup {
                ContentView()
                    .environmentObject(appState)
                    .task { await appState.initializeSDK() }
                    // Optional OAuth fallback: ASWebAuthenticationSession completes the
                    // default flow on its own, but forwarding redirects here covers the
                    // custom-URL-scheme deep-link path.
                    .onOpenURL { url in
                        Task { await appState.handleOpenURL(url) }
                    }
            }
        }
    }

    @MainActor
    final class AppState: ObservableObject {
        @Published var client: WalletsClient?
        @Published var user: User?

        func initializeSDK() async {
            guard let c = try? WalletsClient(
                config: CDPCoreConfig(
                    projectId: "your-project-id",
                    ethereum: EthereumConfig(createOnLogin: .smart)
                )
            ) else {
                print("WalletsClient init failed – verify your project ID")
                return
            }
            await c.start()
            client = c

            await c.onAuthStateChange { [weak self] user in
                Task { @MainActor in self?.user = user }
            }
        }

        // Optional fallback for OAuth redirects delivered as deep links.
        func handleOpenURL(_ url: URL) async {
            try? await client?.handleOAuthCode(url: url)
        }
    }
    ```

    <Tip>
      We're using [Smart Accounts](/wallets/using-wallets/smart-accounts) in this example by setting `EthereumConfig(createOnLogin: .smart)`. This auto-creates a smart account on first sign-in so transaction fees can be sponsored.
    </Tip>
  </Step>

  <Step title="Configure OAuth redirects (social login)">
    OAuth/social login (Google, Apple, Telegram, etc.) runs through `ASWebAuthenticationSession`, which presents the provider, captures the redirect at `{callbackURLScheme}://cdp-oauth-callback`, and completes the flow internally.

    1. Set the `callbackURLScheme` on `CDPCoreConfig`. It defaults to your app's bundle identifier (`Bundle.main.bundleIdentifier`), so set it explicitly only if you want a different scheme:

       ```swift theme={null}
       let config = CDPCoreConfig(
           projectId: "your-project-id",
           callbackURLScheme: "myapp"        // defaults to bundleIdentifier
       )
       ```
    2. Navigate to the [Security Configuration](https://portal.cdp.coinbase.com/wallets/non-custodial/clients) in CDP Portal and add the full redirect URL `myapp://cdp-oauth-callback` to your allowed domains.

    <Note>
      The host segment `cdp-oauth-callback` is fixed by the SDK. The backend matches the full `scheme://host` value — `myapp://cdp-oauth-callback` — against your project's allowed origins, so allowlist the entire value, not just the scheme.
    </Note>

    <Note>
      **Email and SMS authentication work without any OAuth configuration.** These redirect settings are only relevant to OAuth/social login on Apple platforms.
    </Note>

    #### Optional: deep-link fallback

    `ASWebAuthenticationSession` handles the default flow, but you can also register a custom URL scheme and forward the redirect to the SDK as a fallback (this mirrors the SDK's example apps):

    1. Add a `CFBundleURLTypes` entry to your app's `Info.plist` whose `CFBundleURLSchemes` matches your `callbackURLScheme` (for example, `myapp`).
    2. Forward incoming URLs to `handleOAuthCode(url:)` from `.onOpenURL` (see the [initialization example](/wallets/client-side-development/swift#1-set-up-your-swift-project)).
  </Step>
</Steps>

Build and run your app. On launch, `start()` restores any prior session and `onAuthStateChange` fires with the current `User` (or `nil` if signed out).

## 2. Sign in and send your first transaction

Now that the SDK is initialized, let's authenticate, load a wallet, and send a transaction.

<Steps titleSize="p">
  <Step title="Authenticate with email">
    Kick off an Email OTP flow, then verify the code your user receives:

    ```swift theme={null}
    let flow = try await client.signInWithEmail(
        SignInWithEmailOptions(email: "user@example.com")
    )
    let verified = try await client.verifyEmailOTP(
        VerifyEmailOTPOptions(flowId: flow.flowId, otp: "123456")
    )
    print("Signed in as \(verified.user.userId)")
    ```

    For social login, call `signInWithOAuth`. The SDK presents the provider with `ASWebAuthenticationSession`, captures the redirect at `{callbackURLScheme}://cdp-oauth-callback`, and verifies the result automatically:

    ```swift theme={null}
    // Presents the provider and completes the flow internally.
    let flowId = try await client.signInWithOAuth(providerType: .google)

    // Optional: observe in-progress OAuth state while the auth sheet is presented.
    await client.onOAuthStateChange { state in
        // .pending / .success / .error
    }
    ```

    The signed-in `User` arrives through `onAuthStateChange` once the flow completes. Make sure you have configured your OAuth redirect as described in [Configure OAuth redirects](/wallets/client-side-development/swift#1-set-up-your-swift-project).

    SMS OTP, OAuth, Sign-In With Ethereum (SIWE), and developer-issued JWT (BYO auth) are all supported. See [Authentication methods](/wallets/authentication/overview) for the full list.
  </Step>

  <Step title="Load the user's wallet">
    With `EthereumConfig(createOnLogin: .smart)` set in the previous section, a smart account is automatically created the first time a user signs in. You can also create accounts on demand and read the current set of accounts from the `User`:

    ```swift theme={null}
    let smart = try await client.createEvmSmartAccount()   // EndUserEvmSmartAccount
    let eoa = try await client.createEvmEoaAccount()       // EndUserEvmAccount
    let solana = try await client.createSolanaAccount()    // EndUserSolanaAccount

    let user = await client.getCurrentUser()
    user?.evmAccountObjects        // [EndUserEvmAccount]?
    user?.evmSmartAccountObjects   // [EndUserEvmSmartAccount]?
    user?.solanaAccountObjects     // [EndUserSolanaAccount]?
    ```

    All account creation methods accept an optional `idempotencyKey: String`.
  </Step>

  <Step title="Send your first transaction">
    Fund the wallet by visiting the CDP Portal Faucet and requesting Base Sepolia testnet ETH or USDC for your wallet address.

    For an EOA, broadcast a transaction directly:

    ```swift theme={null}
    let tx = EvmTransaction(to: "0x…", value: "1000000000000000")
    let res = try await client.sendEvmTransaction(
        SendEvmTransactionOptions(
            evmAccount: eoa.address,
            network: .baseSepolia,
            transaction: tx
        )
    )
    // res.transactionHash
    ```

    For a Smart Account, send a User Operation with gas sponsorship via the CDP paymaster:

    ```swift theme={null}
    let contract: EvmAddress = "0x…"   // target contract address
    let callData: Hex = "0x"           // ABI-encoded function call
    let call = EvmCall(to: contract, value: "0", data: callData)
    let opRes = try await client.sendUserOperation(
        SendUserOperationOptions(
            evmSmartAccount: smart.address,
            network: .baseSepolia,
            calls: [call],
            useCdpPaymaster: true
        )
    )
    let hash: Hex = opRes.userOperationHash

    // Poll status:
    let status = try await client.getUserOperation(
        GetUserOperationOptions(
            userOperationHash: hash,
            evmSmartAccount: smart.address,
            network: .baseSepolia
        )
    )
    // status.status.rawValue, status.transactionHash
    ```

    <Tip>
      With the configuration [from above](/wallets/client-side-development/swift#1-set-up-your-swift-project), your Smart Account's transaction fees are automatically paid for by [Gas Sponsorship](/wallets/using-wallets/smart-accounts#gas-sponsorship-with-paymaster) when `useCdpPaymaster: true` is set.
    </Tip>

    You've successfully created a user wallet and sent your first transaction natively on iOS!
  </Step>
</Steps>

## Example apps

<CardGroup cols={1}>
  <Card title="CDP Swift SDK" icon="github" href="https://github.com/coinbase/cdp-swift">
    Browse the public Swift SDK repository for the full API surface, release notes, and a runnable SwiftUI demo in the SDK source tree.
  </Card>
</CardGroup>

## What to read next

* **[Authentication methods](/wallets/authentication/overview)**: Learn about Email OTP, SMS OTP, OAuth, SIWE, and BYO auth flows.
* **[Smart Accounts](/wallets/using-wallets/smart-accounts)**: Learn about Smart Accounts and gas sponsorship via the CDP paymaster.
