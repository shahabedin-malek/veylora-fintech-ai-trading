> Coinbase CDP docs — **security** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Android Play Integrity

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

Google Play Integrity lets the CDP backend verify that requests come from your genuine Android app running on a device with valid Google Play Services.
The SDK handles token generation automatically.
You only need to install the package and add one import statement, and configure the CDP Portal.

## Prerequisites

* A free [CDP Portal](https://portal.cdp.coinbase.com) account and project
* A React Native app using the [CDP React Native SDK](/wallets/client-side-development/react-native)
* A Google Cloud project with Play Integrity API enabled
* A physical Android device running Android 6.0 (API level 23) or later with Google Play Services

### Play Store

Play Integrity validates tokens against the signing certificate and package name registered with Google Play. Your app must:

* Be signed with your release key (debug builds will not pass integrity checks).
* Be distributed via the Play Store (any track, including Internal Testing). Apps installed via ADB are rejected.
* Have a package name in your [CDP Portal Security configuration](https://portal.cdp.coinbase.com/wallets/non-custodial/clients) that exactly matches the `applicationId` in your `build.gradle` (e.g. `com.example.myapp`).

<Tip>
  If your app is already live on the Play Store, no additional setup is needed beyond the portal configuration above.

  If you are setting up attestation for the first time, upload a release-signed build to at least the Internal Testing track in Google Play Console before testing.
</Tip>

## Setup

<Steps titleSize="p">
  <Step title="Install packages">
    ```bash theme={null}
    npx expo install @coinbase/cdp-app-attest react-native-device-info
    ```

    `react-native-device-info` is required so the SDK can read your app's package name and match it against the configuration in the CDP Portal.
  </Step>

  <Step title="Add the import to your app entry point">
    Add the following import to your app's entry point (`index.ts` or `index.js`):

    ```ts theme={null}
    import "@coinbase/cdp-app-attest";
    ```

    This import self-registers the attestation module with the CDP SDK.
    No additional function calls are needed.
  </Step>

  <Step title="Set up Google Cloud">
    1. Open [Google Cloud Console](https://console.cloud.google.com) and select or create a project.
    2. Navigate to **APIs & Services → Library** and enable the **Play Integrity API**.
    3. Navigate to **IAM & Admin → Service Accounts** and create a service account.
    4. Create a JSON key for the service account and download it — you will upload this to the CDP Portal.
  </Step>

  <Step title="Configure your app in CDP Portal">
    In your project's [**Security**](https://portal.cdp.coinbase.com/wallets/non-custodial/clients) tab, click on **Add app identifier** in the **Mobile** section.

    This will open a 2-step verification modal that you will need to complete.

    To add an Android app entry, you will need your **package name**, **Google Cloud project number**, and the **service account JSON** from the previous step.
    The project number is a numeric value (distinct from the project ID string).

    Click **Add app identifier** to save. Once saved, the CDP backend will begin enforcing attestation for requests from that app identity.
  </Step>
</Steps>

## How it works

No additional code is required after the import. For operations that require it, such as login OTP requests, the SDK automatically requests a Play Integrity token from Google Play Services and attaches it to the request.

<Info>
  Play Integrity tokens are handed off to Google for validation. Your service account credentials in the CDP Portal are what allow CDP to do this on your behalf.
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

  <Accordion title="Integrity check fails">
    Play Integrity validates that the app was installed via the Play Store. Apps installed via `adb install` or direct APK installation will not produce valid tokens. Install your app through the Play Store (any track).
  </Accordion>

  <Accordion title="Users see authentication errors after you have enabled attestation">
    1. Verify the package name in CDP Portal matches your `applicationId`.
    2. Confirm `@coinbase/cdp-app-attest` is imported in your app entry point.
    3. Confirm `react-native-device-info` is installed.
    4. Confirm the app was installed from the Play Store.
    5. Verify the service account credentials in CDP Portal are valid and not expired.
  </Accordion>
</AccordionGroup>

## What to read next

* [iOS App Attest](/wallets/security-and-policies/app-attestation/ios) — set up attestation for iOS
* [Mobile App Attestation Overview](/wallets/security-and-policies/app-attestation/overview) — understand what attestation protects and how to configure the CDP Portal
* [React Native Quickstart](/wallets/client-side-development/react-native) — get started with user wallets in React Native
