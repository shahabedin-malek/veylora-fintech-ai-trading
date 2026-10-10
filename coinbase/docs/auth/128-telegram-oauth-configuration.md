> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Telegram OAuth Configuration

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

Configure a Telegram bot to enable Telegram authentication for CDP wallets. This guide walks you through creating a bot via BotFather, configuring its domain, and integrating with CDP.

**Time to complete**: \~10 minutes

<Warning>
  **React Native is not currently supported.** Telegram social login is only available for web applications. React Native support is not yet available.
</Warning>

## Prerequisites

Before you begin, ensure you have:

* **Telegram account**: An active Telegram account
* **CDP Project ID**: Available in your CDP Portal dashboard
* **Access to CDP Portal**: Permission to configure user wallet settings

## Step 1: Create a Telegram bot

1. Open Telegram and search for **@BotFather**, or navigate directly to [BotFather](https://t.me/BotFather)

2. Start a conversation and send `/newbot`

3. Follow the prompts:
   * **Name**: Enter a display name for your bot (e.g., "My App Login")
   * **Username**: Enter a unique username ending in `bot` (e.g., `myapp_auth_bot`)

4. BotFather will respond with your **bot token** — copy and save it immediately

<Tip>
  Use your brand or application name as the bot username to prevent user confusion during the login flow. For example, if your app is called "Acme", name your bot `acme_auth_bot`.
</Tip>

## Step 2: Configure bot branding

The bot's profile picture and name are displayed to users during the Telegram login flow. Configure these to match your application's branding:

1. In BotFather, send `/setuserpic` and select your bot
2. Upload your application logo or brand image
3. Optionally, send `/setdescription` to set a description users see when they open the bot

## Step 3: Set the bot domain

Link your bot to the CDP callback domain so Telegram can route authentication requests:

1. In BotFather, send `/setdomain`
2. Select your bot from the list
3. Enter the domain of your application

## Step 4: Configure CDP Portal

Now that your bot is configured, add the credentials to CDP Portal:

<AccordionGroup>
  <Accordion title="Configure Telegram in CDP Portal">
    1. Navigate to the [CDP Portal](https://portal.cdp.coinbase.com/)
    2. Select your project
    3. Go to **Non-custodial Wallet** > **Authentication**
    4. Find the **Telegram** section
    5. Toggle **Enable Telegram** to on
    6. Paste your **Bot Token** from Step 1
    7. Enter your **Bot Username** (e.g., `myapp_auth_bot`)
    8. Click **Save Changes**

    Your Telegram configuration is now active. Any new authentication attempts will use your Telegram bot.
  </Accordion>
</AccordionGroup>

## Step 5: Verification

Test your Telegram configuration:

1. **In your application**, ensure you're calling the Telegram sign-in method (see [SDK Integration](#sdk-integration) below)
2. **Click** "Sign in with Telegram"
3. **Verify** that the Telegram login widget shows your bot's name and profile picture
4. **Complete** the authentication flow
5. **Check** that the user successfully signs in and their wallet is accessible

## SDK Integration

Integrate Telegram authentication in your application using CDP's SDK:

<CodeGroup>
  ```typescript React Hooks theme={null}
  import { useSignInWithOAuth } from '@coinbase/cdp-hooks';

  function LoginButton() {
    const { signInWithOAuth } = useSignInWithOAuth();

    return (
      <button onClick={() => signInWithOAuth('telegram')}>
        Sign in with Telegram
      </button>
    );
  }
  ```

  ```tsx React theme={null}
  import { CDPReactProvider, SignInModal } from '@coinbase/cdp-react';

  function App() {
    const handleSuccess = () => {
      console.log("Sign in successful");
    }
    return (
      <CDPReactProvider config={{ authMethods: ['oauth:telegram'] }}>
        <SignInModal onSuccess={handleSuccess} />
      </CDPReactProvider>
    );
  }
  ```

  ```typescript Vanilla JS theme={null}
  import { signInWithOAuth } from '@coinbase/cdp-core';

  async function handleTelegramSignIn() {
    try {
      await signInWithOAuth('telegram');
      console.log('Successfully signed in with Telegram');
    } catch (error) {
      console.error('Telegram sign-in failed:', error);
    }
  }

  // Call when user clicks sign-in button
  document.getElementById('telegram-signin-btn').addEventListener('click', handleTelegramSignIn);
  ```
</CodeGroup>

<Info>
  The SDK automatically uses your Telegram bot configuration when available. No code changes are needed when updating your bot settings.
</Info>

## Production considerations

<AccordionGroup>
  <Accordion title="Bot token security">
    The bot token is the most critical credential in Telegram authentication:

    * **Store securely**: Use environment variables or a secrets manager — never commit to source control
    * **Rotate periodically**: Use BotFather's `/revoke` command to generate a new token if compromised
    * **Limit access**: Restrict who can access the bot token in your organization
    * **Monitor activity**: Watch for unexpected authentication patterns that could indicate token compromise

    If you suspect your bot token has been compromised, immediately revoke it via BotFather and update it in CDP Portal.
  </Accordion>

  <Accordion title="Branding and user experience">
    Users see your bot's profile during the Telegram login flow:

    * **Bot name**: Use your official product name for brand recognition
    * **Profile picture**: Upload a high-quality logo that matches your app's branding
    * **Bot username**: Choose something recognizable (e.g., `yourapp_auth_bot`)
    * **Description**: Set a clear description explaining the bot's purpose
  </Accordion>

  <Accordion title="Security best practices">
    * **Domain verification**: Ensure only `api.cdp.coinbase.com` is set as the bot domain
    * **Token rotation**: Rotate the bot token periodically and update CDP Portal accordingly
    * **Access control**: Limit who can manage the bot via BotFather
    * **Monitoring**: Track authentication attempts for anomalous patterns
  </Accordion>
</AccordionGroup>

## Troubleshooting

<AccordionGroup>
  <Accordion title="Error: Domain mismatch">
    **Cause**: The bot domain in BotFather doesn't match the URL of your application.

    **Solution**:

    1. Open BotFather and send `/setdomain`
    2. Select your bot
    3. Set the domain to exactly match the URL you are initiating Telegram authentication from
    4. Try authentication again
  </Accordion>

  <Accordion title="Error: Invalid bot token">
    **Cause**: The bot token in CDP Portal is incorrect, expired, or has been revoked.

    **Solution**:

    1. Open BotFather and send `/token` to view your current token
    2. If the token was revoked, send `/revoke` to generate a new one
    3. Update the token in CDP Portal
    4. Ensure no extra spaces or characters were copied
  </Accordion>

  <Accordion title="Error: Bot not found">
    **Cause**: The bot username in CDP Portal doesn't match the actual bot username.

    **Solution**:

    1. Open BotFather and send `/mybots` to see your bots
    2. Verify the exact username (including the `bot` suffix)
    3. Update the username in CDP Portal to match exactly
  </Accordion>

  <Accordion title="User sees wrong bot name or image">
    **Cause**: The bot's profile hasn't been configured or was recently changed.

    **Solution**:

    1. In BotFather, use `/setuserpic` to set or update the bot's profile picture
    2. Use `/setname` to update the display name
    3. Changes may take a few minutes to propagate
  </Accordion>

  <Accordion title="Authentication works but wallet doesn't load">
    **Cause**: This is likely an issue with your CDP configuration, not Telegram.

    **Solution**:

    1. Check CDP status page for potential outages
    2. Verify your CDP Project ID is correct in your application
    3. Ensure you're using the latest SDK version
    4. Contact CDP support if the issue persists
  </Accordion>
</AccordionGroup>

## What to read next

<CardGroup cols={2}>
  <Card title="Custom Social Login Overview" icon="arrow-left" href="/wallets/authentication/social-login/overview">
    Return to social login overview
  </Card>

  <Card title="Google OAuth Setup" icon="google" href="/wallets/authentication/social-login/google">
    Configure Google OAuth
  </Card>

  <Card title="Apple OAuth Setup" icon="apple" href="/wallets/authentication/social-login/apple">
    Configure Apple Sign In
  </Card>

  <Card title="X OAuth Setup" icon="x-twitter" href="/wallets/authentication/social-login/x">
    Configure X OAuth
  </Card>
</CardGroup>
