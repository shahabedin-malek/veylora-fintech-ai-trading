> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Apple OAuth Configuration

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

Configure Apple Sign In with your own Apple Developer credentials to enable custom branding for the Apple authentication experience in CDP wallets. This guide walks you through creating an App ID, Services ID, private key, and integrating with CDP.

**Time to complete**: \~20-30 minutes

<Note>
  Apple Sign In setup is more complex than Google or X OAuth due to additional requirements like private key generation and Services ID configuration.
</Note>

## Prerequisites

Before you begin, ensure you have:

* **Apple Developer account**: Enrollment costs \$99/year at [developer.apple.com](https://developer.apple.com/)
* **CDP Project ID**: Available in your CDP Portal dashboard
* **Access to CDP Portal**: Permission to configure the wallet settings

<Warning>
  **Apple Developer Program required**: Unlike Google and X which offer free tiers, Apple Sign In requires an active Apple Developer Program membership (\$99/year). You cannot configure Apple Sign In without this membership.
</Warning>

## Step 1: Create an App ID

1. Navigate to the [Apple Developer Portal](https://developer.apple.com/account/)

2. Go to **Certificates, Identifiers & Profiles**

3. Select **Identifiers** from the sidebar

4. Click the **+** button to create a new identifier

5. Select **App IDs** and click **Continue**

6. Select **App** as the type and click **Continue**

7. Fill in the App ID details:
   * **Description**: A descriptive name (e.g., "My App - CDP Wallets")
   * **Bundle ID**: Choose "Explicit" and enter a reverse-domain identifier (e.g., `com.yourcompany.app`)

8. Under **Capabilities**, enable **Sign in with Apple**

9. Click **Continue**, then **Register**

<Note>
  The Bundle ID you create here will be referenced when creating the Services ID in the next step. Save this identifier for reference.
</Note>

## Step 2: Create a Services ID

1. Still in **Identifiers**, click the **+** button again

2. Select **Services IDs** and click **Continue**

3. Fill in the Services ID details:
   * **Description**: "CDP Wallets Service" (or custom description)
   * **Identifier**: Enter a unique identifier, different from your App ID (e.g., `com.yourcompany.app.services`)

4. Check **Sign in with Apple**

5. Click **Continue**, then **Register**

6. Back in the Identifiers list, click on your newly created Services ID

7. Check **Sign in with Apple** and click **Configure**

8. In the configuration dialog:
   * **Primary App ID**: Select the App ID you created in Step 1
   * **Domains and Subdomains**: Enter `api.cdp.coinbase.com`
   * **Return URLs**: Click the **+** button and add:
     ```
     https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/apple/callback
     ```

<Warning>
  **Critical**: The return URL must match exactly as shown above. Any differences (including http vs https, trailing slashes, or typos) will cause authentication to fail.
</Warning>

9. Click **Next**, then **Done**
10. Click **Continue**, then **Save**
11. **Copy your Services ID** (e.g., `com.yourcompany.app.services`) - this is your **Client ID**

## Step 3: Create a private key

1. In the Apple Developer Portal, select **Keys** from the sidebar

2. Click the **+** button to create a new key

3. Configure the key:
   * **Key Name**: "CDP Wallets Key" (or custom name)
   * Check **Sign in with Apple**
   * Click **Configure** next to "Sign in with Apple"

4. In the configuration dialog:
   * **Primary App ID**: Select the App ID from Step 1
   * Click **Save**

5. Click **Continue**, then **Register**

6. **Download the key**:
   * Click **Download** to save the `.p8` file
   * **Copy the Key ID** (10-character alphanumeric string displayed on the page)

<Warning>
  **Critical: Save the .p8 file immediately!**

  The private key file can only be downloaded once. If you lose this file, you'll need to revoke the key and create a new one. Store it securely - this file should never be committed to version control or shared publicly.
</Warning>

7. Click **Done**

## Step 4: Gather required information

Before configuring CDP Portal, collect all the required values:

| Field | Description | Example | Where to find it |
| - | - | - | - |
| **Client ID** | Your Services ID | `com.yourcompany.app.services` | Step 2, item 11 |
| **Team ID** | Your Apple Developer Team ID | `A1B2C3D4E5` | Top right of Apple Developer Portal |
| **Key ID** | ID of the private key you created | `X9Y8Z7W6V5` | Step 3, item 6 |
| **Private Key** | Contents of the `.p8` file | `-----BEGIN PRIVATE KEY-----\n...` | Open the `.p8` file in a text editor |

<Tip>
  To find your **Team ID**: Look at the top right corner of the Apple Developer Portal. Your Team ID is a 10-character alphanumeric string next to your account name.
</Tip>

## Step 5: Configure CDP Portal

Now that you have all the required credentials, configure them in the CDP Portal:

<AccordionGroup>
  <Accordion title="Configure Apple Sign In in CDP Portal">
    1. Navigate to the [CDP Portal](https://portal.cdp.coinbase.com/)
    2. Select your project
    3. Go to **Non-custodial Wallet** > **Authentication**
    4. Find the **Apple** section
    5. Toggle **Apple** to on
    6. Enter your configuration values:
       * **Client ID** (Services ID): `com.yourcompany.app.services`
       * **Team ID**: Your 10-character Team ID
       * **Key ID**: Your 10-character Key ID
       * **Signing Key**: Paste the entire contents of your `.p8` file, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
    7. Click **Save Changes**

    Your Apple Sign In configuration is now active. Any new authentication attempts will use your custom Apple OAuth application instead of CDP's default.
  </Accordion>
</AccordionGroup>

## Step 6: Verification

Test your Apple Sign In configuration:

1. **In your application**, ensure you're calling the Apple sign-in method (see [SDK Integration](#sdk-integration) below)
2. **Click** "Sign in with Apple"
3. **Verify** that users can complete the Apple authentication flow
4. **Check** that the user successfully signs in and their wallet is accessible

<Note>
  Apple Sign In can be tested on any device or browser. Unlike some OAuth providers, Apple doesn't require adding test users during development.
</Note>

## SDK Integration

Integrate Apple authentication in your application using CDP's SDK:

<CodeGroup>
  ```typescript React Hooks theme={null}
  import { useSignInWithOAuth } from '@coinbase/cdp-hooks';

  function LoginButton() {
    const { signInWithOAuth } = useSignInWithOAuth();

    return (
      <button onClick={() => signInWithOAuth('apple')} disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in with Apple'}
      </button>
    );
  }
  ```

  ```tsx React theme={null}
  import { CDPReactProvider, SignInModal } from '@coinbase/cdp-react';

  function App() {
    // Render the SignIn component with a custom onSuccess handler
    const handleSuccess = () => {
      console.log("Sign in successful");
    }
    return (
      <CDPReactProvider config={{ authMethods: ['oauth:apple'] }}>
        <SignInModal onSuccess={handleSuccess} />
      </CDPReactProvider>
    );
  }
  ```

  ```typescript Vanilla JS theme={null}
  import { signInWithOAuth } from '@coinbase/cdp-core';

  async function handleAppleSignIn() {
    try {
      await signInWithOAuth('apple');
      console.log('Successfully signed in with Apple');
    } catch (error) {
      console.error('Apple sign-in failed:', error);
    }
  }

  // Call when user clicks sign-in button
  document.getElementById('apple-signin-btn').addEventListener('click', handleAppleSignIn);
  ```
</CodeGroup>

<Info>
  The SDK automatically uses your custom Apple Sign In configuration when available. No code changes are needed when switching from CDP's default to your custom Apple OAuth application.
</Info>

## React Native: Native Apple Sign In

On iOS, the CDP SDK can bypass the WebView OAuth flow entirely and present the native **Sign in with Apple** sheet — giving users the seamless experience they expect from an iOS app.

### How it works

When `@coinbase/cdp-react-native/apple-auth` is registered in your app, the SDK automatically detects it on iOS and uses the native Apple credential flow instead of opening a WebView. The same `signInWithOAuth('apple')` call works unchanged — no conditional logic required in your app code.

### Setup

<Steps titleSize="p">
  <Step title="Install the required packages">
    <CodeGroup>
      ```bash npm theme={null}
      npm install @coinbase/cdp-react-native expo-apple-authentication
      ```

      ```bash pnpm theme={null}
      pnpm add @coinbase/cdp-react-native expo-apple-authentication
      ```

      ```bash yarn theme={null}
      yarn add @coinbase/cdp-react-native expo-apple-authentication
      ```
    </CodeGroup>
  </Step>

  <Step title="Register the native provider at your app entrypoint">
    Add a single import at the top of your app's entrypoint file (e.g., `index.ts`). This registers the native Apple Sign In provider with the CDP SDK as a side effect:

    ```typescript index.ts theme={null}
    import "@coinbase/cdp-react-native/apple-auth";

    // ... rest of your entrypoint
    import "expo-router/entry";
    ```

    <Note>
      This import is intentionally opt-in. Apps that don't need native Apple Sign In (for example, Android-only apps) can skip this import and avoid adding `expo-apple-authentication` as a dependency.
    </Note>
  </Step>

  <Step title="Trigger sign in as normal">
    No changes are needed to your sign-in code. The SDK automatically uses the native path on iOS when the provider is registered:

    ```typescript theme={null}
    import { useSignInWithOAuth } from '@coinbase/cdp-hooks';

    function LoginButton() {
      const { signInWithOAuth } = useSignInWithOAuth();

      return (
        <Button onPress={() => signInWithOAuth('apple')}>
          Sign in with Apple
        </Button>
      );
    }
    ```
  </Step>
</Steps>

## Production considerations

<AccordionGroup>
  <Accordion title="Private key security">
    Your `.p8` private key file is extremely sensitive and must be protected:

    * **Never commit to version control**: Add `.p8` files to your `.gitignore`
    * **Secure storage**: Store in a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
    * **Limited access**: Only authorized personnel should have access to the private key
    * **Rotation policy**: Consider rotating keys periodically (every 6-12 months)
    * **Backup**: Keep a secure backup of the key file in case you need to reconfigure

    If your private key is compromised:

    1. Immediately revoke the key in Apple Developer Portal
    2. Create a new key and update CDP Portal
    3. Investigate the security breach
  </Accordion>

  <Accordion title="Key rotation">
    Apple recommends rotating private keys periodically:

    1. **Create a new key**: Follow Step 3 to generate a new private key
    2. **Update CDP Portal**: Replace the old Key ID and Private Key with new values
    3. **Test thoroughly**: Verify authentication works with the new key
    4. **Revoke old key**: Once confirmed working, revoke the old key in Apple Developer Portal

    Rotation should be done during low-traffic periods to minimize disruption.
  </Accordion>

  <Accordion title="Email privacy handling">
    Apple allows users to hide their email addresses using "Hide My Email":

    * **Private relay emails**: Users can choose a randomly generated email (e.g., `xyz123@privaterelay.appleid.com`)
    * **Forward to real email**: Apple forwards messages to the user's real email
    * **Unique per app**: Each app gets a different private relay email for the same user
    * **User control**: Users can disable email forwarding at any time

    **Implementation considerations**:

    * Accept and store private relay emails as you would any email
    * Don't try to validate private relay email format
    * Allow users to update their email in your app settings
    * Handle bounce backs gracefully if email forwarding is disabled
  </Accordion>

  <Accordion title="App review and compliance">
    Apple may require app review in certain scenarios:

    * **Associated Domains**: If implementing Apple Sign In on iOS/macOS, you need associated domains configured
    * **Sign in with Apple button**: Must follow Apple's Human Interface Guidelines
    * **Account deletion**: If Apple Sign In is your only auth method, you must provide account deletion

    See [Apple's Sign in with Apple guidelines](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple) for complete requirements.
  </Accordion>
</AccordionGroup>

## Troubleshooting

<AccordionGroup>
  <Accordion title="Error: invalid_client">
    **Cause**: The Client ID (Services ID), Team ID, or Key ID is incorrect.

    **Solution**:

    1. Verify the Client ID (Services ID) in CDP Portal matches your Services ID from Apple Developer Portal
    2. Verify the Team ID is correct (check top right corner of Apple Developer Portal)
    3. Verify the Key ID matches the key you created
    4. Ensure no extra spaces or characters were copied
    5. Double-check that all values are from the same Apple Developer account
  </Accordion>

  <Accordion title="Error: invalid_request - redirect_uri">
    **Cause**: The return URL in your Services ID configuration doesn't match the redirect URL.

    **Solution**:

    1. In Apple Developer Portal, go to your Services ID
    2. Click **Configure** next to "Sign in with Apple"
    3. Verify the Return URLs includes exactly: `https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/apple/callback`
    4. Check for trailing slashes, http vs https, and typos
    5. Save changes (may take a few minutes to propagate)
  </Accordion>

  <Accordion title="Error: invalid_key">
    **Cause**: The private key, Key ID, or Team ID don't match, or the key has been revoked.

    **Solution**:

    1. Verify you copied the entire contents of the `.p8` file, including BEGIN and END lines
    2. Check that the Key ID in CDP Portal matches the key you downloaded
    3. Verify the Team ID is correct
    4. Ensure the key hasn't been revoked in Apple Developer Portal (check Keys section)
    5. If the key was revoked, create a new one and update CDP Portal
  </Accordion>

  <Accordion title="Error: Email not provided">
    **Cause**: The user chose to hide their email using "Hide My Email".

    **Solution**:

    * This is not an error - accept the private relay email provided by Apple
    * Store the private relay email (e.g., `xyz123@privaterelay.appleid.com`) as the user's email
    * Apple will forward messages sent to this address to the user's real email
    * Allow users to update their email in your app if needed
  </Accordion>

  <Accordion title="Error: Domain not verified">
    **Cause**: The domain `api.cdp.coinbase.com` is not configured in your Services ID.

    **Solution**:

    1. In Apple Developer Portal, go to your Services ID
    2. Click **Configure** next to "Sign in with Apple"
    3. Under "Domains and Subdomains", ensure `api.cdp.coinbase.com` is listed
    4. If not present, add it and save
    5. Wait a few minutes for changes to propagate
  </Accordion>

  <Accordion title="Authentication works but wallet doesn't load">
    **Cause**: This is likely an issue with your CDP configuration, not Apple Sign In.

    **Solution**:

    1. Check CDP status page for potential outages
    2. Verify your CDP Project ID is correct in your application
    3. Ensure you're using the latest SDK version
    4. Check that the user's email (or private relay email) is being properly passed to CDP
    5. Contact CDP support if the issue persists
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

  <Card title="X OAuth Setup" icon="x-twitter" href="/wallets/authentication/social-login/x">
    Configure X (Twitter) authentication
  </Card>

  <Card title="Authentication Methods" icon="key" href="/wallets/authentication/overview">
    Explore other authentication options
  </Card>
</CardGroup>
