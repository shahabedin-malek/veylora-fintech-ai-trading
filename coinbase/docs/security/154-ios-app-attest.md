> Coinbase CDP docs — **security** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# iOS App Attest

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

Apple App Attest lets the CDP backend cryptographically verify that requests come from your genuine, verified iOS app running on a real Apple device.
The SDK handles attestation automatically.
You only need to install the package and add one import statement, add a capability in Xcode, and configure the CDP Portal.

## Prerequisites

* A free [CDP Portal](https://portal.cdp.coinbase.com) account and project
* A React Native app using the [CDP React Native SDK](/wallets/client-side-development/react-native)
* An Apple Developer account
* A physical iOS device running iOS 14 or later (simulators are not supported)

## Setup

<Steps titleSize="p">
  <Step title="Install packages">
    ```bash theme={null}
    npx expo install @coinbase/cdp-app-attest react-native-device-info
    ```

    `react-native-device-info` is required so the SDK can read your app's bundle ID and match it against the configuration in the CDP Portal.
  </Step>

  <Step title="Add the import to your app entry point">
    Add the following import at the top of your app's entry point:

    ```ts theme={null}
    import "@coinbase/cdp-app-attest";
    ```

    This import self-registers the attestation module with the CDP SDK.
    No additional function calls are needed.
  </Step>

  <Step title="Enable App Attest in Xcode">
    1. Open your project in Xcode.
    2. Select your app target.
    3. Go to **Signing & Capabilities**.
    4. Click **+ Capability** and add **App Attest**.

    This adds the `com.apple.developer.devicecheck.appattest-environment` entitlement to your app.

    <Note>
      The CDP backend accepts both the `development` and `production` App Attest environments.
    </Note>
  </Step>

  <Step title="Configure your app in CDP Portal">
    In your project's [**Security**](https://portal.cdp.coinbase.com/wallets/non-custodial/clients) tab, click on **Add app identifier** in the **Mobile** section.

    This will open a 2-step verification modal that you will need to complete.

    To add an iOS app entry, you will need your **Bundle ID** and **Apple Team ID**.

    You may find your Apple Team ID in your [Apple Developer Account](https://developer.apple.com/account).

    You may also find it in Xcode → select your app target → **Signing & Capabilities**.
    Your Team ID appears next to the Team dropdown (e.g. `ABC123DEF4`).

    Click **Add app identifier** to save. Once saved, the CDP backend will begin enforcing attestation for requests from that app identity.
  </Step>
</Steps>

## How it works

No additional code is required after the import. For operations that require it, such as login OTP requests, the SDK automatically attaches cryptographic proof with no user interaction required.

<Info>
  Validation is performed server-side by CDP and is entirely transparent to your users.
</Info>

<Info>
  Enabling attestation in the portal takes effect immediately. Ensure the updated app version with `@coinbase/cdp-app-attest` installed and imported is fully rolled out to all your users before enabling attestation in the portal. If attestation is enabled while users are still on an older version without the package, they will experience authentication errors.
</Info>

## Troubleshooting

<AccordionGroup>
  <Accordion title="&#x22;Attestation module not registered&#x22; warning">
    You will see this console warning:

    ```
    Attestation module not registered. Install @coinbase/cdp-app-attest and add
    `import '@coinbase/cdp-app-attest'` to your app's entry point.
    ```

    The `@coinbase/cdp-app-attest` import is missing from your app entry point. Add it at the top of the file.
  </Accordion>

  <Accordion title="Attestation fails on simulator">
    Apple App Attest requires a physical device. Run your app on a real iOS device for attestation to work.
  </Accordion>

  <Accordion title="Users see authentication errors after you have enabled attestation">
    1. Verify the bundle ID in CDP Portal matches your app binary.
    2. Confirm `@coinbase/cdp-app-attest` is imported in your app entry point.
    3. Confirm `react-native-device-info` is installed.
    4. Confirm the App Attest capability is enabled in your entitlements.
    5. Confirm you are testing on a physical device, not a simulator.
  </Accordion>
</AccordionGroup>

## What to read next

* [Android Play Integrity](/wallets/security-and-policies/app-attestation/android) - set up attestation for Android
* [Mobile App Attestation Overview](/wallets/security-and-policies/app-attestation/overview) - understand what attestation protects and how to configure the CDP Portal
* [React Native Quickstart](/wallets/client-side-development/react-native) - get started with user wallets in React Native
