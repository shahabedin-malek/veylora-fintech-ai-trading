> Coinbase CDP docs — **onramp-offramp** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Setup

> Set up App2App: a client integration that runs the App Attest ceremony, plus a backend that holds your CDP API key.

This guide walks through a complete App2App setup. For a conceptual overview of how App2App works and why it uses device attestation, see the [overview](/onramp/app2app/overview).

<Note>
  Want a working reference instead of building from scratch? [onramp-v2-mobile-demo](https://github.com/coinbase/onramp-v2-mobile-demo) is a simple, working implementation of this exact flow.
</Note>

<Info>
  **iOS only.** App2App supports iOS with Apple App Attest today. Android isn't supported yet, so use [Coinbase-hosted Onramp](/onramp/coinbase-hosted-onramp/overview) for Android.
</Info>

App2App has two moving pieces: a **client integration** that runs the on-device App Attest ceremony and hands the user off to the Coinbase app, and a **backend** that holds your CDP API key and mints two of the four network calls. A CDP API key can never ship inside a mobile app, so those two calls have to come from somewhere that isn't the device.

This guide is two flows, not one:

<CardGroup cols={2}>
  <Card title="One-time setup" icon="screwdriver-wrench" href="#one-time-setup">
    Install dependencies, configure Xcode, stand up your backend, and register each device. You do this once, not per purchase.
  </Card>

  <Card title="Every purchase" icon="arrow-right-arrow-left" href="#every-purchase">
    Detect the Coinbase app, start the purchase, handle the return, and confirm settlement. This runs every time a user buys.
  </Card>
</CardGroup>

## Prerequisites

* **Get allowlisted.** [Contact the Coinbase team](https://support.cdp.coinbase.com/onramp-onboarding) to enable your CDP project for App2App. Then register your iOS App Attest identifier (`teamID.bundleID`) yourself in [CDP Portal](https://portal.cdp.coinbase.com), under **Payments → Onramp & Offramp → App2App iOS**.
* **Add your redirect host to the domain allowlist.** In [CDP Portal](https://portal.cdp.coinbase.com), under **Payments → Onramp & Offramp**, add the host of the `redirectUrl` you'll use. See [Security Requirements](/onramp/security-requirements) for supported formats. Requests with a `redirectUrl` host that isn't allowlisted are rejected.
* **Stand up a backend that holds a CDP API key.** Minting the attestation challenge and the purchase challenge both require a CDP API-key JWT; the device only ever sees the challenge that comes back, never the key. See [Build your backend](#3-build-your-backend).
* **Use a physical iOS device.** App Attest requires the Secure Enclave, which the iOS Simulator doesn't have. This applies to sandbox testing too, not just production.
* **Use a custom development build, not Expo Go.** `@coinbase/cdp-app-attest` is a native module; Expo Go can't load it. Build with `expo run:ios`, a custom dev client, or EAS Build.
* **Enable the App Attest capability in Xcode** (requires an Apple Developer Program account) with a deployment target of iOS 14+. See Apple's [DeviceCheck documentation](https://developer.apple.com/documentation/devicecheck) and the [App Attest setup guide](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity) for background on what this capability does.

## The four API routes

Everything in this guide comes down to four HTTP calls. The two challenge-mint calls need a CDP API key and run on your backend; the other two are unauthenticated and can be called directly from the device, or proxied through your backend for a single base URL (see [Build your backend](#3-build-your-backend)).

<AccordionGroup>
  <Accordion title="1. Mint attestation challenge">
    ```http theme={null}
    POST /v2/onramp/mobile/attestation/challenges
    ```

    * **Auth:** CDP API key JWT, from your backend
    * **Called:** once per install, before [registering the device](#4-register-each-device)

    No request body.

    ```json Response theme={null}
    {
      "challenge": "<base64url, unpadded>",
      "expiresAt": "<ISO-8601 timestamp>"
    }
    ```
  </Accordion>

  <Accordion title="2. Register the device key">
    ```http theme={null}
    POST /v2/onramp/mobile/attestation/registrations
    ```

    * **Auth:** none
    * **Called:** once per install, right after the device attests the challenge above

    ```json Request theme={null}
    {
      "challenge": "<from the attestation challenge>",
      "ios": {
        "keyId": "<Apple keyId, standard base64>",
        "attestation": "<CBOR attestation object, base64>",
        "bundleId": "<e.g. com.your.app>"
      }
    }
    ```

    ```json Response theme={null}
    {
      "appId": "<teamID.bundleID — not a CDP project ID>",
      "keyId": "<same keyId>",
      "platform": "ios",
      "attestedAt": "<ISO-8601 timestamp>"
    }
    ```
  </Accordion>

  <Accordion title="3. Mint purchase challenge">
    ```http theme={null}
    POST /v2/onramp/mobile/sessions/challenges
    ```

    * **Auth:** CDP API key JWT, from your backend
    * **Called:** once per purchase, before [starting the purchase](#2-start-the-purchase)

    ```json Request theme={null}
    {
      "destinationAddress": "<wallet address>",
      "destinationNetwork": "base",
      "purchaseCurrency": "USDC",
      "paymentCurrency": "USD",
      "redirectUrl": "https://your-allowlisted-host/onramp-return",
      "paymentAmount": "25.00",
      "partnerUserRef": "<your user ID>"
    }
    ```

    ```json Response theme={null}
    {
      "challenge": "<base64url, unpadded>",
      "expiresAt": "<ISO-8601 timestamp>"
    }
    ```
  </Accordion>

  <Accordion title="4. Create the session">
    ```http theme={null}
    POST /v2/onramp/mobile/sessions
    ```

    * **Auth:** none
    * **Called:** once per purchase, right after the device signs the challenge above

    ```json Request theme={null}
    {
      "challenge": "<from the purchase challenge>",
      "ios": {
        "keyId": "<registered keyId, standard base64>",
        "assertion": "<assertion, base64>"
      }
    }
    ```

    ```json Response theme={null}
    {
      "session": {
        "onrampUrl": "https://coinbase.com/onramp?sessionToken=..."
      }
    }
    ```
  </Accordion>
</AccordionGroup>

## One-time setup

Do these four things once, when you build the integration. None of them repeat per purchase.

### 1. Install dependencies

<CodeGroup>
  ```bash npm theme={null}
  npm install @coinbase/cdp-app-attest@latest @coinbase/cdp-react-native@latest
  ```

  ```bash pnpm theme={null}
  pnpm add @coinbase/cdp-app-attest@latest @coinbase/cdp-react-native@latest
  ```

  ```bash yarn theme={null}
  yarn add @coinbase/cdp-app-attest@latest @coinbase/cdp-react-native@latest
  ```
</CodeGroup>

* **`@coinbase/cdp-app-attest`** is required. It's the native module that drives `DCAppAttestService` directly and is what this guide uses for the App Attest ceremony in [Register each device](#4-register-each-device) and [Start the purchase](#2-start-the-purchase).
* **`@coinbase/cdp-react-native`** is optional, used only for its `canOpenCoinbaseOnramp()` and `handleOnrampReturn()` helpers ([Detect the Coinbase app](#1-detect-the-coinbase-app) and [Handle the return](#3-handle-the-return)). This guide does not use its `openCoinbaseOnramp()` function.
* If you're building a native iOS app without React Native, call `DCAppAttestService` directly wherever this guide shows a `@coinbase/cdp-app-attest` call, and `canOpenURL` directly for detection — the request/response shapes are identical.

### 2. Configure your iOS project

<Steps>
  <Step title="Enable the App Attest entitlement">
    In Xcode, add the App Attest capability, or set it directly in your `Info.plist`/entitlements:

    ```xml theme={null}
    <key>com.apple.developer.devicecheck.appattest-environment</key>
    <string>production</string>
    ```

    Use `development` for local debug builds if you want Apple's sandbox App Attest environment; see [Sandbox testing](#sandbox-testing) for how this interacts with `partnerUserRef`.
  </Step>

  <Step title="Declare both Coinbase onramp URL schemes">
    Add the following to `Info.plist` so `canOpenCoinbaseOnramp()` can detect the installed Coinbase app:

    ```xml theme={null}
    <key>LSApplicationQueriesSchemes</key>
    <array>
      <string>com.coinbase.cdp.onramp.v2</string>
      <string>com.coinbase.cdp.onramp</string>
    </array>
    ```

    This isn't a Coinbase-side setting: iOS requires your app to declare any scheme it intends to query with `canOpenURL`, or the call always returns `false`. Declare **both** schemes:

    * `com.coinbase.cdp.onramp.v2` is registered by newer Coinbase app builds that support the current App2App input contract (`purchaseAmount`, `paymentMethod`).
    * `com.coinbase.cdp.onramp` is the legacy scheme, still registered by older Coinbase app builds. `canOpenCoinbaseOnramp()` treats either as "supported" so users on an older Coinbase app build aren't incorrectly told App2App is unavailable.

    Only Coinbase app versions that support App2App register these schemes at all, which is what makes [detection](#1-detect-the-coinbase-app) a real capability check rather than a plain "is Coinbase installed" check.
  </Step>
</Steps>

### 3. Build your backend

Add two routes, one per authenticated call. Each signs a CDP API key JWT and forwards to CDP:

```ts theme={null}
import { generateJwt } from "@coinbase/cdp-sdk/auth";

async function mintChallenge(path: string, body?: unknown) {
  const token = await generateJwt({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    requestMethod: "POST",
    requestHost: "api.cdp.coinbase.com",
    requestPath: `/platform${path}`,
    expiresIn: 120,
  });

  const res = await fetch(`https://api.cdp.coinbase.com/platform${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

// Used once per install, by "Register each device" below
app.post("/app2app/attestation-challenge", async (req, res) => {
  res.json(await mintChallenge("/v2/onramp/mobile/attestation/challenges"));
});

// Used on every purchase, by "Start the purchase" below
app.post("/app2app/purchase-challenge", async (req, res) => {
  res.json(await mintChallenge("/v2/onramp/mobile/sessions/challenges", req.body));
});
```

<Tip>
  The other two calls, registration and session creation, stay unauthenticated. You can call them directly from the device (see [Register each device](#4-register-each-device) and [Start the purchase](#2-start-the-purchase)), or proxy them through this same backend for a single base URL and centralized logging, the way the [reference demo app](https://github.com/coinbase/onramp-v2-mobile-demo/blob/main/server/src/app.ts) does. Proxying them is a convenience, not a requirement, since they don't need your CDP API key.
</Tip>

### 4. Register each device

Do this once per install, before the device's first purchase. Persist the registration locally, scoped to your CDP project ID.

<Tip>
  Run [Detect the Coinbase app](#1-detect-the-coinbase-app) first and only register if it returns `true`. There's no reason to spend an App Attest ceremony and a network round trip registering a device that can't complete a purchase anyway.
</Tip>

`attest()` and `createAssertion()` (used here and in [Start the purchase](#2-start-the-purchase)) both expect standard base64 input, but CDP mints challenges as base64url (unpadded). Convert before signing:

```tsx theme={null}
function base64urlToBase64(value: string): string {
  let out = value.replace(/-/g, '+').replace(/_/g, '/');
  while (out.length % 4 !== 0) out += '=';
  return out;
}
```

```tsx theme={null}
import { attest, getOnrampRegisteredKeyId, confirmOnrampRegistration, clearOnrampAttestation } from '@coinbase/cdp-app-attest';

async function registerDevice(projectId: string) {
  if (await getOnrampRegisteredKeyId(projectId)) return; // already registered

  const { challenge } = await fetch('/app2app/attestation-challenge', { method: 'POST' }).then(r => r.json());

  const attestation = await attest(base64urlToBase64(challenge)); // -> { ios: { keyId, attestation, bundleId } }

  try {
    const registration = await fetch('/v2/onramp/mobile/attestation/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge, ios: attestation.ios }),
    }).then(r => r.json());

    await confirmOnrampRegistration(projectId, registration.keyId);
  } catch (err) {
    await clearOnrampAttestation(projectId); // the key is already consumed; force a fresh one next time
    throw err;
  }
}
```

<AccordionGroup>
  <Accordion title="Where does this call actually go?">
    Straight to CDP (`https://api.cdp.coinbase.com/platform/v2/onramp/mobile/attestation/registrations`), or to your backend's pass-through proxy if you built one. Either way, it's unauthenticated: no `Authorization` header, no `projectId` or `keyId` path params. `keyId` travels only in the body — App Attest key IDs are standard base64 and often contain `/`, which breaks path routing at the edge. See [The four API routes](#the-four-api-routes) above for the exact request and response.
  </Accordion>

  <Accordion title="Why clear the registration on any failure, even a network error?">
    Apple's `attestKey` is a one-time operation per key: if registration fails after `attest()` succeeds, the key's attestation slot is already consumed. Always clear the local registration on failure (as shown above) so the next attempt provisions a fresh key, rather than retrying `attest()` on the same one.
  </Accordion>
</AccordionGroup>

`attest()` calls `DCAppAttestService.attestKey` under the hood with `clientDataHash = SHA-256(base64url_decode(challenge))`. If you're calling `DCAppAttestService` directly instead, apply that same decode-then-hash order; hashing the base64url string directly fails verification.

## Every purchase

This flow repeats for every purchase a signed-in user makes. It assumes [one-time setup](#one-time-setup) is already done.

### 1. Detect the Coinbase app

Before showing or enabling your "Pay with Coinbase" button, check whether the installed Coinbase app supports App2App:

```tsx theme={null}
import { canOpenCoinbaseOnramp } from '@coinbase/cdp-react-native';

const supported = await canOpenCoinbaseOnramp();
if (supported) {
  // show "Pay with Coinbase" button
} else {
  // fall back to Coinbase-hosted Onramp
}
```

`canOpenCoinbaseOnramp()` probes both schemes declared in [Configure your iOS project](#2-configure-your-ios-project) and resolves `false` on Android (App2App isn't available there yet) or if either probe throws. Re-run this check whenever your app returns to the foreground, in case the user installed or removed the Coinbase app while your app was backgrounded.

Not using React Native? Probe both schemes with `canOpenURL` directly and treat either `true` as supported:

```
canOpenURL("com.coinbase.cdp.onramp.v2://")
canOpenURL("com.coinbase.cdp.onramp://")
```

<Warning>
  This only checks whether the installed Coinbase app supports App2App — it says nothing about the user themselves. Purchase eligibility (KYC, region, limits) is only known after handoff, once the user is signed in. If the check returns `false`, fall back to [Coinbase-hosted Onramp](/onramp/coinbase-hosted-onramp/overview) so the user can still complete a purchase.
</Warning>

### 2. Start the purchase

Call this when the user taps your "Pay with Coinbase" button:

```tsx theme={null}
import { createAssertion } from '@coinbase/cdp-app-attest';
import { Linking } from 'react-native';

async function startPurchase(order: PurchaseOrder) {
  const { challenge } = await fetch('/app2app/purchase-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order), // no projectId — the backend's JWT carries it
  }).then(r => r.json());

  const assertion = await createAssertion(base64urlToBase64(challenge)); // -> { ios: { keyId, assertion } }

  const { session } = await fetch('/v2/onramp/mobile/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge, ios: assertion.ios }),
  }).then(r => r.json());

  await Linking.openURL(session.onrampUrl);
}
```

`order` is the body your backend forwards to `/v2/onramp/mobile/sessions/challenges`. There's no `projectId` field: the challenge is minted under your backend's CDP API key JWT, and that JWT is what identifies the project.

<Accordion title="Order parameters & pricing reference">
  | Field | Required | Notes |
  | - | - | - |
  | `destinationAddress` | Yes | The wallet that receives the crypto. Must be valid for `destinationNetwork` |
  | `destinationNetwork` | Yes | A blockchain name, e.g. `base` (not `base-mainnet`) |
  | `purchaseCurrency` | Yes | A Coinbase ticker (`USDC`, not `usdc`) or asset ID |
  | `paymentCurrency` | No | A prefill hint for the fiat currency to start from. If omitted, Coinbase lets the signed-in user pick from their available funding sources |
  | `redirectUrl` | Yes | An absolute `https` URL. The host must be on your domain allowlist |
  | `paymentAmount` | Exactly one of `paymentAmount` / `purchaseAmount` | How much **fiat the user spends, fee-inclusive**. E.g. `"25.00"` means the user pays exactly \$25 total; fees come out of the crypto side, so they may receive slightly less crypto than a naive rate conversion would suggest |
  | `purchaseAmount` | Exactly one of `paymentAmount` / `purchaseAmount` | How much **crypto the user receives, fee-exclusive**. This is a literal crypto-denominated amount, not a fiat value. E.g. `"0.01"` means the user receives exactly 0.01 ETH; Coinbase charges extra fiat on top to cover fees |
  | `paymentMethod` | No | One of `CARD`, `ACH`, `APPLE_PAY`, `FIAT_WALLET`, `CRYPTO_WALLET`. A prefill hint for the Coinbase-app handoff screen; omit it to let the user pick from their own available sources |
  | `partnerUserRef` | Required to confirm settlement | Your own user identifier, max 50 characters (see the note below) |
  | `country` / `subdivision` | No | Optional ISO 3166-1 / 3166-2 codes. Not currently used to restrict anything; Coinbase determines eligibility from the signed-in account after handoff |

  The purchase challenge doesn't return a quote or eligibility details. To surface accurate information to the user before handoff, pull from:

  * [Buy Config](/api-reference/rest-api/onramp-offramp/get-buy-config): countries and payment methods
  * [Buy Options](/api-reference/rest-api/onramp-offramp/get-buy-options): assets, networks, and limits
  * [Buy Quote](/api-reference/rest-api/onramp-offramp/create-buy-quote): an actual fee breakdown

  All three return estimates; Coinbase applies the signed-in user's real limits and eligibility after they land in the Coinbase app. The [Onramp Asset Availability tool](https://onramp-asset-availability.vercel.app/) does the same lookup visually, by region.
</Accordion>

<Tip>
  **`partnerUserRef` is your user identifier.** You generate it; Coinbase never creates or looks it up on its own. Send the same value every time for a given user (max 50 characters), and Coinbase echoes it back to you in three places so you can tie everything together:

  * In the [redirect](#3-handle-the-return) query parameters
  * In the [webhook](#4-confirm-the-transaction) payload
  * In the [transactions API](#4-confirm-the-transaction) response
</Tip>

* `challenge` expires **5 minutes** after it's minted. If the session call returns `stale_attestation`, mint a fresh purchase challenge and retry with a new assertion; keep the same registered device key.
* The session call is **idempotent** on the challenge: if you don't receive a response (for example, due to a dropped connection), retry it. Retrying an already-attested challenge returns the same URL rather than an error.
* The returned `onrampUrl`'s session token expires **15 minutes** after it's issued.

<Warning>
  **Each session is single-use.** Once the Coinbase app opens the URL, the session is consumed. If the user closes or force-quits the Coinbase app before finishing, start a new purchase rather than reopening the same URL.
</Warning>

<Accordion title="What if the attestation key becomes invalid?">
  Registered keys can go stale (for example, a key left over from a deleted TestFlight install). If `/v2/onramp/mobile/sessions` rejects the assertion with an invalid-key error, self-heal by clearing the registration and re-running [Register each device](#4-register-each-device) before retrying the purchase once:

  ```tsx theme={null}
  import { clearOnrampAttestation } from '@coinbase/cdp-app-attest';

  try {
    await startPurchase(order);
  } catch (err) {
    if (!isAttestationKeyError(err)) throw err;
    await clearOnrampAttestation(projectId);
    await registerDevice(projectId);
    await startPurchase(order); // retry once
  }
  ```

  Match `isAttestationKeyError` against the error message (phrases like "invalid key," "key not found," or "assertion could not be verified"). This mirrors the retry pattern in the [reference demo app](https://github.com/coinbase/onramp-v2-mobile-demo/blob/main/utils/app2AppOnramp.ts).
</Accordion>

### 3. Handle the return

The Coinbase app redirects back to your `redirectUrl` as a universal link with one of three outcomes. There's no `reason` code on any of them; the query parameters below are everything you get:

| `status` | When you'll see it | Query parameters |
| - | - | - |
| `success` | The purchase (and send) completed | `transactionId`, `sessionToken`, `partnerUserRef` if provided, `handshakeNonce` if available |
| `error` | The session couldn't be validated, the user isn't eligible (unsupported country or asset, region restrictions), the user needs to update their Coinbase app, or the transaction was attempted and failed | `sessionToken`, `partnerUserRef` if provided |
| `cancelled` | The user left before attempting a transaction: closed the flow, backed out of the preview screen, or exited the passcode/biometric prompt | `sessionToken`, `partnerUserRef` if provided |

If you're using `@coinbase/cdp-react-native`, call `handleOnrampReturn` in your deep-link handler every time your app receives this redirect:

```tsx theme={null}
import { handleOnrampReturn } from '@coinbase/cdp-react-native';
import * as Linking from 'expo-linking';

Linking.addEventListener('url', ({ url }) => {
  if (url.includes('onramp-return')) {
    handleOnrampReturn({ returnUrl: url }).catch(console.error);
  }
});
```

This is currently a no-op: CDP doesn't yet issue the `handshakeNonce`-based security handshake that `handleOnrampReturn` will eventually perform. Adding the call now means your app automatically participates once the backend starts requiring it, with no further code changes on your end.

* `handshakeNonce` is only included on `success`.
* `error` and `cancelled` carry no detail about what went wrong or how far the user got. If you need to distinguish "not eligible" from "transaction failed," you can't do it from the redirect alone.
* If the user isn't already signed in to Coinbase, they'll sign in or create an account (and complete KYC if they're new) before the purchase continues, all inside the Coinbase app, with no separate step needed from you.

<Warning>
  **Never credit a balance from the redirect.** The redirect is for showing the right screen to your user, not for confirming settlement; it isn't signed and shouldn't be trusted on its own. Always confirm the purchase with a [webhook or the transactions API](#4-confirm-the-transaction) before crediting anything.
</Warning>

Backgrounding the Coinbase app doesn't lose the redirect: it fires normally once the user returns and completes or backs out of the flow, no matter how long they were away. The redirect is only permanently lost if the Coinbase app is force-quit or killed by the OS before the user comes back. Don't block your UI waiting for a redirect indefinitely.

### 4. Confirm the transaction

<Tip>
  **Subscribe to a webhook. Don't build your primary confirmation path around polling.** Coinbase sends a webhook to your backend when a transaction is created, updated, or settles. Set up a subscription once and get pushed a notification the moment a purchase completes, instead of pulling for it.
</Tip>

1. Follow the [Onramp & Offramp Webhooks](/webhooks/onramp) guide to create a webhook subscription for `onramp.transaction.success` (and `.created` / `.updated` / `.failed` if you want the intermediate states).
2. Match incoming events to your user with `partnerUserRef`; it's included in every payload.
3. Treat a transaction as settled only when the event is `onramp.transaction.success` (or, if you're inspecting the payload directly, `status` is `ONRAMP_TRANSACTION_STATUS_SUCCESS`).
4. App2App transactions include `isAppToApp: true`, so you can distinguish them from other purchase flows if needed.

If you'd rather pull instead of (or in addition to) receiving webhooks (for reconciliation, backfilling, or debugging a specific user), poll the [Get onramp transactions by ID](/api-reference/rest-api/onramp-offramp/get-onramp-transactions-by-id) endpoint with a [CDP API key JWT](/api-reference/v2/authentication#generate-bearer-token-jwt-and-export), using the same `partnerUserRef` you sent when [starting the purchase](#2-start-the-purchase):

```
GET https://api.developer.coinbase.com/onramp/v1/buy/user/{partnerUserRef}/transactions
```

* Match transactions using `partnerUserRef` plus `txHash`, purchase currency, and amount. The redirect's `transactionId` doesn't match the `transactionId` returned by this endpoint: they're generated by different systems for the same purchase, so don't use them to join records, even though the redirect's value now looks like a real ID on a live purchase rather than a placeholder.
* Sandbox (dry-run) sessions are the exception to both of the above; see [Sandbox testing](#sandbox-testing).

## Sandbox testing

You can exercise the full flow (registration, challenge, session, handoff, and redirect) without moving real funds. There's no way to skip App Attest just to preview the UI: every purchase, sandbox or live, runs the real attestation ceremony on a physical device — the iOS Simulator can't attest at all, since it has no Secure Enclave.

Which path applies depends on the build you're testing with:

| Build | App Attest environment | `partnerUserRef` |
| - | - | - |
| TestFlight, App Store, or a local build with the `production` entitlement | Production | Prefix with `sandbox-` to dry-run the flow without moving funds. Omit it for a live purchase. |
| Xcode debug build (the default; see [Configure your iOS project](#2-configure-your-ios-project)) | Development/sandbox | **Must** be prefixed with `sandbox-`. A dev/sandbox App Attest key is rejected outright without it — there's no way to use one for a live purchase. |

Either way, a `partnerUserRef` like `sandbox-user-1234` is what puts the session into sandbox mode; there's no separate sandbox flag, endpoint, or allowlist.

<Accordion title="What actually happens in sandbox mode?">
  The user experience is identical to a real purchase: sign-in, confirmation, and redirect all run normally, and the redirect still includes a `transactionId` generated for that sandbox purchase only. But no webhook fires and no row appears in the transactions API — the redirect is the only confirmation signal you get in sandbox. See [Confirm the transaction](#4-confirm-the-transaction).
</Accordion>

* Keep the `sandbox-` prefix until you're ready to move real funds; it's independent of which App Attest environment you're using.

## Errors

<Warning>
  Error responses may change. Coinbase will communicate breaking changes before they take effect whenever possible.
</Warning>

| Situation | Status | `errorType` | Action |
| - | - | - | - |
| Missing or invalid CDP API key JWT | 401 | `unauthorized` | Fix the JWT your backend attaches to the challenge-mint call |
| Invalid request, invalid redirect host, or an address that doesn't match the network | 400 | `invalid_request` | Fix the request and retry |
| Unknown purchase currency | 400 | `invalid_request` | Use a supported ticker or asset ID |
| Unknown challenge | 400 | `invalid_request` | Create a new challenge |
| Registration attestation failed | 400 | `invalid_request` | Create a new registration challenge; generate a new key if it fails again |
| Purchase assertion failed | 400 | `invalid_request` | Create a new purchase challenge; only re-register your device key after repeated failures |
| Development or sandbox App Attest key used without a `sandbox-` `partnerUserRef` | 400 | `invalid_request` | Prefix `partnerUserRef` with `sandbox-`, or use a production App Attest key |
| Challenge older than 5 minutes | 422 | `stale_attestation` | Create a new challenge and re-attest |
| CDP project not enabled for App2App | 403 | `forbidden` | [Contact the Coinbase team](https://support.cdp.coinbase.com/onramp-onboarding) |
| Service unavailable | 503 | `service_unavailable` | Retry later |
| Rate limited | 429 | `rate_limit_exceeded` | Back off and retry |

## What to read next

* **[FAQ](/onramp/app2app/faq):** Common questions from partners integrating App2App
* **[Onramp & Offramp Webhooks](/webhooks/onramp):** Full webhook setup and payload reference
* **[Security Requirements](/onramp/security-requirements):** Domain allowlist requirements for your redirect URL
* **[onramp-v2-mobile-demo](https://github.com/coinbase/onramp-v2-mobile-demo):** Full reference implementation of the client and backend pieces in this guide
