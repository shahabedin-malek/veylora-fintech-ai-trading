> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Google OAuth Configuration

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

Configure your own Google OAuth application to enable custom branding and control over the Google Sign-In experience for CDP wallets. This guide walks you through creating a Google Cloud project, configuring OAuth credentials, and integrating with CDP.

**Time to complete**: \~15-20 minutes

## Prerequisites

Before you begin, ensure you have:

* **Google Cloud Platform account**: Sign up at [console.cloud.google.com](https://console.cloud.google.com/)
* **CDP Project ID**: Available in your CDP Portal dashboard
* **Access to CDP Portal**: Permission to configure user wallet settings

## Step 1: Create a Google Cloud project

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top of the page
3. Click **New Project**
4. Enter a project name (e.g., "My App - CDP")
5. Click **Create**
6. Once created, select your new project from the project dropdown

<Note>
  If you already have a Google Cloud project for your application, you can use that existing project instead of creating a new one.
</Note>

## Step 2: Configure OAuth consent screen

1. In the Google Cloud Console, navigate to **Google Auth Platform** > **Audience**

2. Choose a user type:
   * **Internal**: Only users within your Google Workspace organization can sign in (requires Google Workspace)
   * **External**: Any user with a Google account can sign in

3. In the **Test users** section (if using External user type):
   * Add test users if your app is still in testing mode

4. Click **Branding**

5. Fill in the required fields:
   * **App name**: Your application's name (shown to users during OAuth)
   * **User support email**: Your support email address
   * **App logo**: (Optional) Upload your app's logo
   * **Application home page**: Your application's URL
   * **Application privacy policy link**: Link to your privacy policy
   * **Application terms of service link**: Link to your terms of service
   * **Authorized domains**: Add your application's domain(s)
   * **Developer contact information**: Your email address

6. On the **Data Access** screen:
   * Click **Add or Remove Scopes**
   * Add the following scopes:
     * `.../auth/userinfo.email`
     * `.../auth/userinfo.profile`
     * `openid`
   * Click **Update** then **Save**

7. Review your configuration and click **Back to Dashboard**

<Warning>
  **For production use**: If you selected "External" user type, you may need to submit your app for Google's verification process before users can authenticate. Apps in "Testing" mode are limited to 100 users. See [Google's OAuth verification documentation](https://support.google.com/cloud/answer/9110914) for details.
</Warning>

## Step 3: Create OAuth 2.0 credentials

1. In the Google Cloud Console, navigate to **Google Auth Platform** > **Clients**

2. Click **Create client**

3. Choose **Web application** as the application type

4. Enter a name for the OAuth client (e.g., "My App - CDP")

5. Under **Authorized redirect URIs**, click **Add URI**

6. Enter the exact redirect URI:
   ```
   https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/google/callback
   ```

<Warning>
  **Critical**: The redirect URI must match exactly as shown above. Any differences (including http vs https, trailing slashes, or typos) will cause authentication to fail.
</Warning>

7. Click **Create**
8. A dialog will appear with your **Client ID** and **Client Secret**
9. Copy both values and store them securely - you'll need them in the next step

<Tip>
  You can always retrieve your Client ID and Client Secret later by clicking on your OAuth client in the Credentials page.
</Tip>

## Step 4: Configure CDP Portal

Now that you have your Google OAuth credentials, configure them in the CDP Portal:

<AccordionGroup>
  <Accordion title="Configure Google OAuth in CDP Portal">
    1. Navigate to the [CDP Portal](https://portal.cdp.coinbase.com/)
    2. Select your project
    3. Go to **Non-custodial Wallet** > **Authentication**
    4. Find the **Google** section
    5. Toggle **Google** to on
    6. Paste your **Client ID** from Step 3
    7. Paste your **Client Secret** from Step 3
    8. Click **Save Changes**

    Your Google OAuth configuration is now active. Any new authentication attempts will use your custom OAuth application instead of CDP's default.
  </Accordion>
</AccordionGroup>

## Step 5: Verification

Test your Google OAuth configuration:

1. **In your application**, ensure you're calling the Google sign-in method (see [SDK Integration](#sdk-integration) below)
2. **Click** "Sign in with Google"
3. **Verify** that the OAuth consent screen shows your application name (not "Coinbase" or "CDP")
4. **Complete** the authentication flow
5. **Check** that the user successfully signs in and their wallet is accessible

<Note>
  During testing, if your OAuth consent screen is in "Testing" mode, only users you've added as test users can authenticate.
</Note>

## SDK Integration

Integrate Google authentication in your application using CDP's SDK:

<CodeGroup>
  ```typescript React Hooks theme={null}
  import { useSignInWithOAuth } from '@coinbase/cdp-hooks';

  function LoginButton() {
    const { signInWithOAuth } = useSignInWithOAuth();

    return (
      <button onClick={() => signInWithOAuth('google')} disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in with Google'}
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
      <CDPReactProvider config={{ authMethods: ['oauth:google'] }}>
        <SignInModal onSuccess={handleSuccess} />
      </CDPReactProvider>
    );
  }
  ```

  ```typescript Vanilla JS theme={null}
  import { signInWithOAuth } from '@coinbase/cdp-core';

  async function handleGoogleSignIn() {
    try {
      await signInWithOAuth('google');
      console.log('Successfully signed in with Google');
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  }

  // Call when user clicks sign-in button
  document.getElementById('google-signin-btn').addEventListener('click', handleGoogleSignIn);
  ```
</CodeGroup>

<Info>
  The SDK automatically uses your custom OAuth configuration when available. No code changes are needed when switching from CDP's default to your custom OAuth application.
</Info>

## Production considerations

<AccordionGroup>
  <Accordion title="OAuth app verification">
    Google may require app verification before your OAuth application can be used in production:

    * **Apps in Testing mode**: Limited to 100 users
    * **Unverified apps**: Show a warning screen to users
    * **Verified apps**: No user limit, no warning screen

    To request verification:

    1. Navigate to the **OAuth consent screen** in Google Cloud Console
    2. Click **Publish App**
    3. Follow Google's verification process (may take several days)

    See [Google's OAuth verification documentation](https://support.google.com/cloud/answer/9110914) for detailed requirements.
  </Accordion>

  <Accordion title="Rate limits">
    Google imposes rate limits on OAuth requests:

    * **Default limits**: Generally sufficient for most applications
    * **Requesting increases**: If you need higher limits, submit a request through the [Google Cloud Console quota page](https://console.cloud.google.com/iam-admin/quotas)
    * **Monitoring usage**: Track your OAuth usage in the Google Cloud Console to avoid hitting limits

    Rate limits are per OAuth application, so using your own application gives you dedicated capacity.
  </Accordion>

  <Accordion title="Brand consistency">
    Ensure your OAuth consent screen reflects your production branding:

    * **App name**: Use your official product name
    * **App logo**: Upload a high-quality logo (512x512px recommended)
    * **Privacy policy and terms**: Link to your production policies
    * **Support email**: Use your official support email address

    Users will see this information every time they authenticate, so maintain professional branding.
  </Accordion>

  <Accordion title="Security best practices">
    * **Client Secret**: Store your Client Secret securely (environment variables, secrets manager)
    * **Rotation**: Consider rotating your Client Secret periodically
    * **Access control**: Limit who can access your Google Cloud project
    * **Monitoring**: Enable logging in Google Cloud Console to track authentication attempts
    * **Scopes**: Only request the minimum scopes needed (email, profile, openid)
  </Accordion>
</AccordionGroup>

## Troubleshooting

<AccordionGroup>
  <Accordion title="Error: redirect_uri_mismatch">
    **Cause**: The redirect URI in your OAuth configuration doesn't match the one configured in Google Cloud Console.

    **Solution**:

    1. Verify the exact redirect URI in your Google Cloud Console credentials
    2. Ensure it matches: `https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/google/callback`
    3. Check for trailing slashes, http vs https, and typos
    4. Save changes in Google Cloud Console (may take a few minutes to propagate)
  </Accordion>

  <Accordion title="Error: access_blocked">
    **Cause**: Your OAuth consent screen is not properly configured or approved.

    **Solution**:

    1. Verify your OAuth consent screen is complete with all required fields
    2. If using "External" user type in Testing mode, add the user as a test user
    3. If the user isn't in your Google Workspace, switch to "External" user type
    4. Consider publishing your app for verification if ready for production
  </Accordion>

  <Accordion title="Error: invalid_client">
    **Cause**: The Client ID or Client Secret is incorrect or has been revoked.

    **Solution**:

    1. Verify the Client ID in CDP Portal matches the one in Google Cloud Console
    2. Verify the Client Secret in CDP Portal matches the one in Google Cloud Console
    3. If you regenerated credentials, update them in CDP Portal
    4. Ensure no extra spaces or characters were copied
  </Accordion>

  <Accordion title="Users can't see the sign-in option">
    **Cause**: OAuth application is not published or is in restricted mode.

    **Solution**:

    1. In Google Cloud Console, check the OAuth consent screen status
    2. If in "Testing" mode, only test users can authenticate
    3. Click "Publish App" to make it available to all users
    4. Note: Publishing may require verification for External apps
  </Accordion>

  <Accordion title="Authentication works but wallet doesn't load">
    **Cause**: This is likely an issue with your CDP configuration, not Google OAuth.

    **Solution**:

    1. Check CDP status page for potential outages
    2. Verify your CDP Project ID is correct in your application
    3. Ensure you're using the latest SDK version
    4. Check that the user's email is being properly passed to CDP
    5. Contact CDP support if the issue persists
  </Accordion>
</AccordionGroup>

## What to read next

<CardGroup cols={2}>
  <Card title="Custom Social Login Overview" icon="arrow-left" href="/wallets/authentication/social-login/overview">
    Return to social login overview
  </Card>

  <Card title="Apple OAuth Setup" icon="apple" href="/wallets/authentication/social-login/apple">
    Configure Apple Sign In
  </Card>

  <Card title="X OAuth Setup" icon="x-twitter" href="/wallets/authentication/social-login/x">
    Configure X (Twitter) authentication
  </Card>

  <Card title="Authentication Methods" icon="key" href="/wallets/authentication/overview">
    Explore other authentication options
  </Card>
</CardGroup>
