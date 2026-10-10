> Coinbase CDP docs — **sdk-ui** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# React Native Quickstart

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

Use React Native to build mobile apps with Coinbase Developer Platform (CDP) user wallets in under 5 minutes!

Your React Native apps can leverage **EVM Externally Owned Accounts (EOA)**, **EVM Smart Accounts**, and **Solana Accounts**, bringing different blockchain compatibility directly to iOS and Android users.

Get up and running fast by integrating our wallet infrastructure into your React Native project with [`create-cdp-app`](https://www.npmjs.com/package/@coinbase/create-cdp-app).

<Tip>
  All [CDP React hooks](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks) are compatible with React Native. Check out the [CDP React SDK reference](/sdks/cdp-sdks-v2/frontend) for comprehensive method signatures, types, and examples.
</Tip>

<Accordion title="What makes React Native user wallets special?">
  React Native user wallets bring the same powerful CDP wallet infrastructure to mobile apps with:

  * **Native mobile performance**: Optimized for iOS and Android
  * **Familiar mobile UX**: Email and social login flows users expect
  * **Cross-platform support**: Write once, run on iOS and Android
  * **Expo compatibility**: Works seamlessly with managed and bare Expo workflows
</Accordion>

## Prerequisites

* A free [CDP Portal](https://portal.cdp.coinbase.com) account.
* [Node.js 22+](https://nodejs.org/en/download).
* A node package manager installed (i.e., `npm` or `pnpm`).
* Installed [iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/).
* Installed [Android Emulator](https://docs.expo.dev/workflow/android-studio-emulator/).

### Minimum Version Requirements

| | |
| - | - |
| Xcode | 16.1 |
| iOS | 15.1 |
| Android Studio | Latest stable |
| Android SDK | API 24 (min) / API 35 (target) |
| Android | 7.0 (API 24) |

Let's get started by scaffolding a new React Native app with the necessary dependencies.

## 1. Create the React Native app

<Steps titleSize="p">
  <Step title="Copy your Project ID">
    Navigate to [CDP Portal](https://portal.cdp.coinbase.com) and select your project from the top-left dropdown. Clicking the gear icon will take you to your project details:

    Copy the **Project ID** value. You will use this in the next step when configuring your demo app.
  </Step>

  <Step title="Create a new React Native app">
    Use the latest version of `create-cdp-app` to create a new React Native app:

    <CodeGroup>
      ```bash npm theme={null}
      npm create @coinbase/cdp-app@latest
      ```

      ```bash pnpm theme={null}
      pnpm create @coinbase/cdp-app@latest
      ```

      ```bash yarn theme={null}
      yarn create @coinbase/cdp-app@latest
      ```
    </CodeGroup>
  </Step>

  <Step title="Configure your app">
    Follow the prompts to configure your app with a user wallet. Name your project, select `React Native with Expo` as a template, and enter your CDP Project ID that you copied in the previous step.

    <Tip>
      1. Make sure to select `React Native with Expo` as a template.

      2. In this example we are using [Smart Accounts](/wallets/using-wallets/smart-accounts) to create a smart account for new users on sign in.
         This allows us to pay for transaction fees on behalf of the user.
    </Tip>

    ```console theme={null}
    Ok to proceed? (y) y

    > npx
    > create-cdp-app

    ✔ App Name: … my-react-native-app
    ✔ Template: › React Native with Expo
    ✔ CDP Project ID (Find your project ID at https://portal.cdp.coinbase.com/projects/overview): … <YOUR_PROJECT_ID>
    ✔ Account Type: › EVM Smart Accounts
    ```

    <Note>
      This example uses EVM Smart accounts, but we also support EVM EOA accounts and Solana accounts for React Native.
    </Note>
  </Step>

  <Step title="Configure deep linking for OAuth (Optional)">
    If you plan to use social login with React Native (Google, Apple, etc.), you need to configure deep linking:

    1. Navigate to the [Security Configuration](https://portal.cdp.coinbase.com/wallets/non-custodial/clients) in CDP Portal
    2. Add `cdp-rn-demo://callback` to your allowed domains

    <Note>
      The demo app is pre-configured with the deep link scheme `cdp-rn-demo://callback`. This is required for OAuth/social login to redirect users back to your app after authentication.

      **Email and SMS authentication work without this step.** Deep links are only required for OAuth/social login in React Native (OAuth works out-of-the-box on web with standard HTTPS redirects).

      For your production app, replace `cdp-rn-demo` with your own custom scheme (configured in your `app.json`). See our [Implementation Guide](/wallets/authentication/implementation-guide#react-native-social-login-configuration) for details.
    </Note>
  </Step>

  <Step title="Run your app">
    Navigate to your project directory and start the development server:

    <Tip>
      Be prepared to wait a few minutes the first time you run the app for the dev server and simulator to boot up.
    </Tip>

    <CodeGroup>
      ```bash npm theme={null}
      cd my-react-native-app
      npm install
      npm run ios # or npm run android
      ```

      ```bash pnpm theme={null}
      cd my-react-native-app
      pnpm install
      pnpm run ios # or pnpm run android
      ```

      ```bash yarn theme={null}
      cd my-react-native-app
      yarn install
      yarn run ios # or yarn run android
      ```
    </CodeGroup>
  </Step>
</Steps>

On successful startup, you should see your React Native app running on the iOS simulator or Android emulator.

Open up the App.tsx file and start editing to see your changes live.

## 2. Sign in and send your first transaction

Now that your user wallet is configured and your app is running, let's try it out.

<Steps titleSize="p">
  <Step title="Authenticate with email, SMS, or Social">
    Choose between email or SMS to receive a verification code. Social login will complete after you authenticate with your Provider.

    <Frame>
      <img src="https://mintcdn.com/coinbase-prod/kt8yDgpB8UeHhzQM/images/rn-auth-method.png?fit=max&auto=format&n=kt8yDgpB8UeHhzQM&q=85&s=52bece5d3fb6c641cf7dd5b0b4a5c6d8" alt="React Native authentication method screen" width="546" height="1026" data-path="images/rn-auth-method.png" />
    </Frame>
  </Step>

  <Step title="Verify">
    Enter the verification code sent to your email or phone number.

    <Frame>
      <img src="https://mintcdn.com/coinbase-prod/kt8yDgpB8UeHhzQM/images/rn-otp.png?fit=max&auto=format&n=kt8yDgpB8UeHhzQM&q=85&s=a6cb693e605a3f217699e0a5e61131b0" alt="React Native OTP screen" width="546" height="1026" data-path="images/rn-otp.png" />
    </Frame>
  </Step>

  <Step title="View your new wallet">
    Congrats! Your new user wallet has been created, authenticated, and is ready to use on all EVM compatible networks.

    <Tip>
      We're using [Smart Accounts](/wallets/using-wallets/smart-accounts) in this example.
      If you're not using Smart Accounts, you will see a slightly different transaction screen, with a link to get testnet ETH instead of USDC.
    </Tip>

    <Frame>
      <img src="https://mintcdn.com/coinbase-prod/kt8yDgpB8UeHhzQM/images/rn-wallet-created.png?fit=max&auto=format&n=kt8yDgpB8UeHhzQM&q=85&s=370f8951209676ac85c44365090a3cf1" alt="React Native post login screen" width="546" height="1026" data-path="images/rn-wallet-created.png" />
    </Frame>
  </Step>

  <Step title="Send your first transaction">
    The demo app uses the wallet to send itself some testnet tokens on Base Sepolia.

    Get some testnet funds by tapping the **Get funds from faucet** button which will give you a link to the [CDP Portal Faucet](https://portal.cdp.coinbase.com/products/faucet) prefilled with your wallet address and token.
    Once you claim the funds, the balance shown in the app will update automatically. Finally, tap **Transfer** to initiate the transfer. Once complete, you'll see a transaction hash and a button to copy a link to the blockchain explorer.

    <Tip>
      If you used the same configuration [from above](/wallets/client-side-development/react-native#create-the-react-native-app), you will have a Smart Account who's transaction fees will
      be automatically paid for by a feature called [Gas Sponsorship](/wallets/using-wallets/smart-accounts#gas-sponsorship-with-paymaster).
    </Tip>

    <Frame>
      <img src="https://mintcdn.com/coinbase-prod/kt8yDgpB8UeHhzQM/images/rn-tx-sent.png?fit=max&auto=format&n=kt8yDgpB8UeHhzQM&q=85&s=901c2b9fdc3d1dce0e888748bb042ae6" alt="React Native wallet demo showing transaction flow" width="546" height="1026" data-path="images/rn-tx-sent.png" />
    </Frame>

    🎉 You've successfully created a user wallet and sent your first transaction on mobile!
  </Step>
</Steps>

## Example apps

<CardGroup cols={3}>
  <Card title="Expo" icon="github" href="https://github.com/coinbase/cdp-wallet-demo-apps/tree/main/apps/react-native-expo">
    React Native with Expo managed workflow
  </Card>

  <Card title="Bare React Native" icon="github" href="https://github.com/coinbase/cdp-wallet-demo-apps/tree/main/apps/react-native-bare">
    React Native without Expo
  </Card>

  <Card title="Expo + Wagmi" icon="github" href="https://github.com/coinbase/cdp-wallet-demo-apps/tree/main/apps/react-native-expo-wagmi">
    Expo with Wagmi integration
  </Card>
</CardGroup>

## What to read next

* **[React Hooks](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks)**: Explore all available CDP hooks
* **[Authentication Methods](/wallets/authentication/overview)**: Learn about available user authentication methods
* **[Smart Accounts](/wallets/using-wallets/smart-accounts)**: Learn about Smart Accounts and how to use them
