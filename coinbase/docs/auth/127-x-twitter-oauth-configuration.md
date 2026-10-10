> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# X (Twitter) OAuth Configuration

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

Configure your own X (formerly Twitter) OAuth application to enable custom branding for the X authentication experience in CDP wallets. This guide walks you through creating an X Developer account, configuring an OAuth 2.0 app, and integrating with CDP.

**Time to complete**: \~15-20 minutes

<Note>
  X (formerly known as Twitter) rebranded in 2023, but the authentication process is still commonly referred to as "Twitter login" or "X login".
</Note>

## Prerequisites

Before you begin, ensure you have:

* **X Developer account**: Free tier available at [developer.x.com](https://developer.x.com/)
* **CDP Project ID**: Available in your CDP Portal dashboard
* **Access to CDP Portal**: Permission to configure user wallet settings

<Warning>
  **Rate limits on free tier**: X imposes strict rate limits even on the free developer tier. For production applications with significant traffic, you may need to upgrade to a paid tier.
</Warning>

## Step 1: Create X Developer account

1. Navigate to [developer.x.com](https://developer.x.com/)

2. Click **Sign In** and authenticate with your X account

3. If you don't have developer access yet, click **Apply for a developer account**

4. Complete the developer application:
   * **What is your primary reason for using the X API?**: Select the most appropriate option (e.g., "Building tools for X users")
   * **What are you planning to do with the X API?**: Describe your application (e.g., "Enable users to authenticate and access web3 wallets using their X account")
   * **Will your app use Tweet, Retweet, Like, Follow, or Direct Message functionality?**: Select "No" (unless you need these features)
   * Complete any additional required fields

5. Review and accept the X Developer Agreement

6. Click **Submit** and wait for approval (usually instant for basic access)

<Note>
  Most applications are approved instantly for basic OAuth access. If additional review is required, you'll receive an email notification.
</Note>

## Step 2: Create X app

1. Once your developer account is approved, navigate to the [X Developer Portal](https://developer.x.com/en/portal/dashboard)

2. Click **+ Create Project** or **+ Add App**

3. Fill in the app details:
   * **App name**: Your application name (visible to users during OAuth, e.g., "My App")
   * **App description**: Brief description of your application
   * **Website URL**: Your application's website
   * **Callback URL**: Leave blank for now (we'll configure this in Step 3)

4. Click **Create** or **Next**

<Tip>
  The app name you choose here will be displayed to users during the X OAuth flow, so use your official product name for brand consistency.
</Tip>

## Step 3: Configure OAuth 2.0 settings

1. In your X app dashboard, navigate to **Settings** or **App settings**

2. Scroll to **User authentication settings** section

3. Click **Set up** or **Edit**

4. Configure OAuth 2.0:
   * **App permissions**: Select **Read** (minimum required for authentication)
   * **Type of App**: Select **Web App**
   * **App info**:
     * **Callback URI / Redirect URL**: Enter the exact URL:
       ```
       https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/x/callback
       ```
     * **Website URL**: Your application's website URL

<Warning>
  **Critical**: The Callback URI must match exactly as shown above. Any differences (including http vs https, trailing slashes, or typos) will cause authentication to fail.
</Warning>

5. Click **Save**

6. After saving, you'll see your OAuth 2.0 credentials:
   * **Client ID**: Copy this value
   * **Client Secret**: Click **Generate** or **Regenerate** to create a secret, then copy it

<Tip>
  Store your Client ID and Client Secret securely. You can always regenerate the Client Secret if needed, but this will invalidate the previous secret.
</Tip>

## Step 4: Enable OAuth 2.0

Ensure OAuth 2.0 is properly enabled for your app:

1. In your app settings, verify that **OAuth 2.0** is enabled
2. Confirm the **Read** permission is granted (minimum requirement)
3. Check that the Callback URI is correctly configured

<Note>
  Additional app permissions (Write, Direct Messages) require X app review. For authentication purposes, **Read** permission is sufficient.
</Note>

## Step 5: Configure CDP Portal

Now that you have your X OAuth credentials, configure them in the CDP Portal:

<AccordionGroup>
  <Accordion title="Configure X OAuth in CDP Portal">
    1. Navigate to the [CDP Portal](https://portal.cdp.coinbase.com/)
    2. Select your project
    3. Go to **Non-custodial Wallet** > **Authentication**
    4. Find the **X** section
    5. Toggle **Enable X OAuth** to on
    6. Paste your **Client ID** from Step 3
    7. Paste your **Client Secret** from Step 3
    8. Click **Save Changes**

    Your X OAuth configuration is now active. Any new authentication attempts will use your custom OAuth application instead of CDP's default.
  </Accordion>
</AccordionGroup>

## Step 6: Verification

Test your X OAuth configuration:

1. **In your application**, ensure you're calling the X sign-in method (see [SDK Integration](#sdk-integration) below)
2. **Click** "Sign in with X"
3. **Verify** that the OAuth consent screen shows your application name
4. **Complete** the authentication flow
5. **Check** that the user successfully signs in and their wallet is accessible

<Note>
  During testing, you can use any X account to authenticate. Unlike some providers, X doesn't require adding test users during development.
</Note>

## SDK Integration

Integrate X authentication in your application using CDP's SDK:

<CodeGroup>
  ```typescript React Hooks theme={null}
  import { useSignInWithOAuth } from '@coinbase/cdp-hooks';

  function LoginButton() {
    const { signInWithOAuth } = useSignInWithOAuth();

    return (
      <button onClick={() => signInWithOAuth('x')} disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in with X'}
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
      <CDPReactProvider config={{ authMethods: ['oauth:x'] }}>
        <SignInModal onSuccess={handleSuccess} />
      </CDPReactProvider>
    );
  }
  ```

  ```typescript Vanilla JS theme={null}
  import { signInWithOAuth } from '@coinbase/cdp-core';

  async function handleXSignIn() {
    try {
      await signInWithOAuth('x');
      console.log('Successfully signed in with X');
    } catch (error) {
      console.error('X sign-in failed:', error);
    }
  }

  // Call when user clicks sign-in button
  document.getElementById('x-signin-btn').addEventListener('click', handleXSignIn);
  ```
</CodeGroup>

<Info>
  The SDK automatically uses your custom X OAuth configuration when available. No code changes are needed when switching from CDP's default to your custom OAuth application.
</Info>

## Production considerations

<AccordionGroup>
  <Accordion title="Rate limits and quotas">
    X imposes strict rate limits on OAuth and API requests:

    **Free tier limits**:

    * **OAuth requests**: Limited number of authentication requests per 15-minute window
    * **User lookup**: Limited API calls for fetching user information
    * **Monthly caps**: Overall monthly limits on API usage

    **For production**:

    * **Monitor usage**: Track your OAuth request volume in X Developer Portal
    * **Upgrade tiers**: Consider X API Pro or Enterprise for higher limits
    * **Rate limit handling**: Implement proper error handling for rate limit responses (HTTP 429)
    * **Caching**: Cache user information to minimize API calls

    **Request rate limit increases**:

    1. Navigate to X Developer Portal
    2. Go to your app settings
    3. Look for "Request rate limit increase" or contact X support
    4. Provide justification and expected usage patterns
  </Accordion>

  <Accordion title="App review and permissions">
    Basic OAuth authentication only requires **Read** permission, which doesn't require app review. However:

    * **Additional permissions**: Write, Direct Messages, or other advanced permissions require X app review
    * **Review process**: Can take several days to weeks
    * **Elevated access**: Some features require X API Pro or Enterprise subscription

    For authentication purposes, **Read** permission is sufficient and doesn't require review.
  </Accordion>

  <Accordion title="Branding and user experience">
    Ensure your X OAuth experience reflects your brand:

    * **App name**: Update to your official product name in app settings
    * **App icon**: Upload your logo in app settings (shown during OAuth flow)
    * **App description**: Keep concise and clear about what users are authenticating for
    * **Website URL**: Link to your main product page

    Users will see this information every time they authenticate, so maintain professional branding.
  </Accordion>

  <Accordion title="Security and credentials">
    * **Client Secret**: Store securely (environment variables, secrets manager)
    * **Rotation**: Regenerate Client Secret periodically for security
    * **Access control**: Limit who can access your X Developer Portal account
    * **Monitoring**: Enable notifications for unusual app activity
    * **Scopes**: Only request minimum required permissions (Read for authentication)
  </Accordion>
</AccordionGroup>

## Troubleshooting

<AccordionGroup>
  <Accordion title="Error: Callback URL mismatch">
    **Cause**: The Callback URI in your X app configuration doesn't match the redirect URL.

    **Solution**:

    1. In X Developer Portal, go to your app's User authentication settings
    2. Verify the Callback URI exactly matches: `https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/x/callback`
    3. Check for trailing slashes, http vs https, and typos
    4. Save changes in X Developer Portal (may take a few minutes to propagate)
    5. Try authentication again
  </Accordion>

  <Accordion title="Error: Invalid client credentials">
    **Cause**: The Client ID or Client Secret is incorrect or has been regenerated.

    **Solution**:

    1. Verify the Client ID in CDP Portal matches the one in X Developer Portal
    2. Verify the Client Secret in CDP Portal matches the current secret
    3. If you regenerated the Client Secret, update it in CDP Portal
    4. Ensure no extra spaces or characters were copied
    5. Check that the credentials are from the correct X app
  </Accordion>

  <Accordion title="Error: App not approved / insufficient permissions">
    **Cause**: Your app requires permissions that need X review, or the app hasn't been approved.

    **Solution**:

    1. Verify you only selected **Read** permission (doesn't require review)
    2. If you need additional permissions, submit your app for X review
    3. Check X Developer Portal for any pending review requirements
    4. Ensure your X Developer account is in good standing
    5. Contact X support if approval is taking longer than expected
  </Accordion>

  <Accordion title="Error: Rate limit exceeded (429)">
    **Cause**: You've exceeded X's rate limits for OAuth requests.

    **Solution**:

    1. Implement exponential backoff retry logic in your application
    2. Cache user authentication states to reduce OAuth requests
    3. Monitor your usage in X Developer Portal
    4. Consider upgrading to X API Pro for higher limits
    5. Spread authentication requests over time if doing bulk testing
  </Accordion>

  <Accordion title="User sees authorization error">
    **Cause**: The user may have previously denied access, or there's an issue with permissions.

    **Solution**:

    1. Ask the user to revoke app access in X settings and try again:
       * Go to X Settings > Security and account access > Apps and sessions
       * Find your app and revoke access
       * Try authenticating again
    2. Verify your app has the correct permissions (Read minimum)
    3. Check that the user's X account is in good standing
    4. Ensure OAuth 2.0 is enabled in your app settings
  </Accordion>

  <Accordion title="Authentication works but wallet doesn't load">
    **Cause**: This is likely an issue with your CDP configuration, not X OAuth.

    **Solution**:

    1. Check CDP status page for potential outages
    2. Verify your CDP Project ID is correct in your application
    3. Ensure you're using the latest SDK version
    4. Check that the user's X username/ID is being properly passed to CDP
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

  <Card title="Apple OAuth Setup" icon="apple" href="/wallets/authentication/social-login/apple">
    Configure Apple Sign In
  </Card>

  <Card title="Authentication Methods" icon="key" href="/wallets/authentication/overview">
    Explore other authentication options
  </Card>
</CardGroup>
