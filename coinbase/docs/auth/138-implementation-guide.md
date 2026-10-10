> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Implementation Guide

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

There are three ways to implement authentication in your application, each offering different levels of customization and control:

1. **`AuthButton` component from `@coinbase/cdp-react`**: Pre-built UI component (fastest integration)
2. **React hooks from `@coinbase/cdp-hooks`**: For custom React UIs with state management
3. **Direct methods from `@coinbase/cdp-core`**: For vanilla JavaScript/TypeScript or non-React frameworks

<Warning>
  **Important authentication considerations:**

  * Always check if a user is already signed in before starting a new authentication flow. Attempting to call `verifyEmailOTP` or 'verifySMSOTP\` while a user is already authenticated will result in an error and may leave the application in an inconsistent state.
  * To sign out users, use the `signOut()` method from `@coinbase/cdp-core`, the `useSignOut()` hook from `@coinbase/cdp-hooks`, or the `AuthButton` component which handles sign out automatically.
</Warning>

## AuthButton component (simplest)

For the fastest integration, `@coinbase/cdp-react` provides a pre-built `AuthButton` component that handles the entire authentication flow with a single line of code.

<Note>
  For more CDP React components and styling options, see the [React Components documentation](/wallets/client-side-development/react-components).

  By default, email authentication is the only method enabled. For enabling additional methods, refer to the [AppConfig documentation](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-react#appconfig)
</Note>

<CodeGroup>
  ```tsx Basic setup theme={null}
  import { type Config, CDPReactProvider } from "@coinbase/cdp-react";
  import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";

  const config: Config = {
    projectId: "your-project-id",
    ethereum: {
      createOnLogin: "eoa",
    },
    appName: "React Library Demo",
    appLogoUrl: "https://picsum.photos/64",
    // Enabled authentication methods
    authMethods: ["email", "sms", "oauth:google"],
  };

  function App() {
    return (
      <CDPReactProvider config={config}>
        <YourApp />
      </CDPReactProvider>
    );
  }
  ```

  ```tsx Simple sign-in screen theme={null}
  import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";

  function SignInScreen() {
    return (
      <main>
        <h1>Welcome!</h1>
        <p>Please sign in to continue.</p>
        <AuthButton />
      </main>
    );
  }
  ```

  ```tsx Complete example with auth state theme={null}
  import { useIsInitialized, useIsSignedIn } from "@coinbase/cdp-hooks";
  import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";

  function App() {
    const { isInitialized } = useIsInitialized();
    const { isSignedIn } = useIsSignedIn();

    if (!isInitialized) {
      return <div>Loading...</div>;
    }

    return (
      <div>
        <header>
          <h1>My App</h1>
          <AuthButton /> {/* Shows "Sign In" or "Sign Out" automatically */}
        </header>

        <main>
          {!isSignedIn && <p>Please sign in to access your wallet</p>}
          {isSignedIn && <p>Welcome! You're signed in.</p>}
        </main>
      </div>
    );
  }
  ```

  ```tsx With user info theme={null}
  import { useEvmAddress } from "@coinbase/cdp-hooks";
  import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";

  function Header() {
    const { evmAddress } = useEvmAddress();

    return (
      <header>
        <h1>CDP App</h1>
        <div className="user-info">
          {evmAddress && (
            <span>
              {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
            </span>
          )}
          <AuthButton />
        </div>
      </header>
    );
  }
  ```
</CodeGroup>

<Tip>
  The `AuthButton` component automatically:

  * Shows "Sign In" when the user is not authenticated
  * Shows "Sign Out" when the user is authenticated
  * Handles the entire Email or SMS OTP flow internally
  * Manages loading and error states
  * Follows your theme configuration

  This is the recommended approach for most applications that want a quick, production-ready authentication experience.
</Tip>

## React hooks

For React applications, `@coinbase/cdp-hooks` provides convenient hooks that handle state management and re-renders automatically.

<CodeGroup>
  ```tsx React hooks setup theme={null}
  import { CDPHooksProvider } from "@coinbase/cdp-hooks";
  import { type Config } from "@coinbase/cdp-core";

  const config: Config = {
    projectId: "your-project-id",
    ethereum: {
      createOnLogin: "eoa",
    },
  };

  // Wrap your app with the provider
  function App() {
    return (
      <CDPHooksProvider config={config}>
        <YourApp />
      </CDPHooksProvider>
    );
  }
  ```
</CodeGroup>

Full config options:

| Option | Type | Required | Description |
| - | - | - | - |
| `projectId` | `string` | Yes | Your CDP project ID |
| `ethereum.createOnLogin` | `"eoa" \| "smart"` | No | Auto-create an EVM account on sign-in |
| `solana.createOnLogin` | `boolean` | No | Auto-create a Solana account on sign-in |
| `basePath` | `string` | No | Override the CDP API base URL |
| `useMock` | `boolean` | No | Use mock data instead of live APIs (local testing) |
| `debugging` | `boolean` | No | Log all API requests and responses |

<CodeGroup>
  ```tsx Email OTP Authentication with hooks theme={null}
  import { useSignInWithEmail, useVerifyEmailOTP } from "@coinbase/cdp-hooks";

  function SignInComponent() {
    const { signInWithEmail } = useSignInWithEmail();
    const { verifyEmailOTP } = useVerifyEmailOTP();
    const [flowId, setFlowId] = useState<string | null>(null);

    const handleEmailSubmit = async (email: string) => {
      try {
        // Start sign in flow
        const { flowId } = await signInWithEmail({ email });
        setFlowId(flowId);
        // Show OTP input UI
      } catch (error) {
        console.error("Failed to send OTP:", error);
      }
    };

    const handleOTPSubmit = async (otp: string) => {
      if (!flowId) return;

      try {
        // Complete sign in
        const { user, isNewUser } = await verifyEmailOTP({
          flowId,
          otp
        });

        console.log("Signed in user:", user);
        console.log("User EVM address:", user.evmAccounts[0]);
        console.log("Is new user:", isNewUser);
      } catch (error) {
        console.error("Sign in failed:", error);
      }
    };

    // Return your UI components...
  }
  ```

  ```tsx SMS OTP Authentication with hooks theme={null}
  import { useSignInWithSms, useVerifySmsOTP } from "@coinbase/cdp-hooks";

  function SignInComponent() {
    const { signInWithSms } = useSignInWithSms();
    const { verifySmsOTP } = useVerifySmsOTP();
    const [flowId, setFlowId] = useState<string | null>(null);

    const handlePhoneNumberSubmit = async (phoneNumber: string) => {
      try {
        // Start sign in flow with E.164 formatted phone number (ex. +15554443333)
        const { flowId } = await signInWithSms({ phoneNumber });
        setFlowId(flowId);
        // Show OTP input UI
      } catch (error) {
        console.error("Failed to send OTP:", error);
      }
    };

    const handleOTPSubmit = async (otp: string) => {
      if (!flowId) return;

      try {
        // Complete sign in
        const { user, isNewUser } = await verifySmsOTP({
          flowId,
          otp
        });

        console.log("Signed in user:", user);
        console.log("User EVM address:", user.evmAccounts[0]);
        console.log("Is new user:", isNewUser);
      } catch (error) {
        console.error("Sign in failed:", error);
      }
    };

    // Return your UI components...
  }
  ```

  ```tsx Google OAuth authentication with hooks theme={null}
  import { useSignInWithOAuth } from "@coinbase/cdp-hooks";

  function SignInComponent() {
    const { signInWithOAuth } = useSignInWithOAuth();

    const handleGoogleSignIn = () => {
      // User will be redirected to Google to complete their login
      void signInWithOAuth("google");

      // Post-login, they will be redirected back to your app, and the login process
      // will be completed automatically.
    }

    // Return your UI components...
  }
  ```

  ```tsx Apple OAuth authentication with hooks theme={null}
  import { useSignInWithOAuth } from "@coinbase/cdp-hooks";

  function SignInComponent() {
    const { signInWithOAuth } = useSignInWithOAuth();

    const handleAppleSignIn = () => {
      // User will be redirected to Apple to complete their login
      void signInWithOAuth("apple");

      // Post-login, they will be redirected back to your app, and the login process
      // will be completed automatically.
    }

    // Return your UI components...
  }
  ```

  ```tsx X OAuth authentication with hooks theme={null}
  import { useSignInWithOAuth } from "@coinbase/cdp-hooks";

  function SignInComponent() {
    const { signInWithOAuth } = useSignInWithOAuth();

    const handleXSignIn = () => {
      // User will be redirected to X to complete their login
      void signInWithOAuth("x");

      // Post-login, they will be redirected back to your app, and the login process
      // will be completed automatically.
    }

    // Return your UI components...
  }
  ```

  ```tsx Session management with hooks theme={null}
  import { useCurrentUser, useIsSignedIn } from "@coinbase/cdp-hooks";

  function UserProfile() {
    const { user } = useCurrentUser();
    const { isSignedIn } = useIsSignedIn();

    if (!isSignedIn) {
      return <div>Please sign in</div>;
    }

    return (
      <div>
        <h2>Welcome!</h2>
        <p>User ID: {user?.userId}</p>
        <p>Email: {user?.authenticationMethods.email?.email}</p>
        <p>Wallet Address: {user?.evmAccounts[0]}</p>
      </div>
    );
  }
  ```

  ```tsx Complete example component theme={null}
  import React, { useState } from 'react';
  import { useSignInWithEmail, useVerifyEmailOTP, useIsSignedIn } from "@coinbase/cdp-hooks";

  export function AuthenticationFlow() {
    const { signInWithEmail, loading: emailLoading } = useSignInWithEmail();
    const { verifyEmailOTP, loading: otpLoading } = useVerifyEmailOTP();
    const { isSignedIn } = useIsSignedIn();

    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [flowId, setFlowId] = useState<string | null>(null);
    const [step, setStep] = useState<'email' | 'otp'>('email');

    if (isSignedIn) {
      return <div>You are already signed in!</div>;
    }

    const handleEmailSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const result = await signInWithEmail({ email });
        setFlowId(result.flowId);
        setStep('otp');
      } catch (error) {
        console.error('Failed to send OTP:', error);
      }
    };

    const handleOTPSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!flowId) return;

      try {
        const { user } = await verifyEmailOTP({ flowId, otp });
        console.log('Authentication successful!', user);
      } catch (error) {
        console.error('Failed to verify OTP:', error);
      }
    };

    if (step === 'email') {
      return (
        <form onSubmit={handleEmailSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={emailLoading}
          />
          <button type="submit" disabled={emailLoading}>
            {emailLoading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      );
    }

    return (
      <form onSubmit={handleOTPSubmit}>
        <p>Enter the code sent to {email}</p>
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="123456"
          maxLength={6}
          required
          disabled={otpLoading}
        />
        <button type="submit" disabled={otpLoading}>
          {otpLoading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    );
  }
  ```
</CodeGroup>

<Note>
  The React hooks automatically handle loading states, error states, and re-renders when authentication state changes. They're the recommended approach for React applications.
</Note>

## Direct methods

The `@coinbase/cdp-core` package provides the low-level authentication primitives for maximum control over the user experience. This approach is ideal for non-React applications or when you need fine-grained control.

<CodeGroup>
  ```typescript Email OTP authentication flow theme={null}
  import { initialize, signInWithEmail, verifyEmailOTP } from '@coinbase/cdp-core';

  // Step 1: Initialize the CDP SDK
  await initialize({
    projectId: 'your-project-id'
  });

  // Step 2: Initiate email authentication
  const { flowId, message } = await signInWithEmail({
    email: 'user@example.com'
  });
  console.log(message); // "OTP sent to user@example.com"

  // Step 3: Verify the OTP code
  const { user, isNewUser } = await verifyEmailOTP({
    flowId,
    otp: '123456'
  });

  // User is now authenticated and has access to their wallet
  console.log('User ID:', user.userId);
  console.log('EVM Addresses:', user.evmAccounts);
  console.log('Is new user:', isNewUser);
  ```

  ```typescript SMS OTP authentication flow theme={null}
  import { initialize, signInWithSms, verifySmsOTP } from '@coinbase/cdp-core';

  // Step 1: Initialize the CDP SDK
  await initialize({
    projectId: 'your-project-id'
  });

  // Step 2: Initiate SMS authentication
  const { flowId, message } = await signInWithSms({
    // E.164 format
    phoneNumber: '+15554443333'
  });
  console.log(message); // "Authentication initiated successfully. Please check your phone for the verification code."

  // Step 3: Verify the OTP code
  const { user, isNewUser } = await verifySmsOTP({
    flowId,
    otp: '123456'
  });

  // User is now authenticated and has access to their wallet
  console.log('User ID:', user.userId);
  console.log('EVM Addresses:', user.evmAccounts);
  console.log('Is new user:', isNewUser);
  ```

  ```typescript Google OAuth authentication flow theme={null}
  import { initialize, signInWithOAuth } from '@coinbase/cdp-core';

  // Step 1: Initialize the CDP SDK
  await initialize({
    projectId: 'your-project-id'
  });

  // Step 2: Initiate Google OAuth sign-in
  // User will be redirected to Google to complete their login
  // After login, they will be redirected back to your app, and the login
  // process will be completed automatically by the SDK
  try {
    void signInWithOAuth("google");
  } catch (error) {
    console.error("Failed to sign in with Google:", error);
  }
  ```

  ```typescript Apple OAuth authentication flow theme={null}
  import { initialize, signInWithOAuth } from '@coinbase/cdp-core';

  // Step 1: Initialize the CDP SDK
  await initialize({
    projectId: 'your-project-id'
  });

  // Step 2: Initiate Apple OAuth sign-in
  // User will be redirected to Apple to complete their login
  // After login, they will be redirected back to your app, and the login
  // process will be completed automatically by the SDK
  try {
    void signInWithOAuth("apple");
  } catch (error) {
    console.error("Failed to sign in with Apple:", error);
  }
  ```

  ```typescript X OAuth authentication flow theme={null}
  import { initialize, signInWithOAuth } from '@coinbase/cdp-core';

  // Step 1: Initialize the CDP SDK
  await initialize({
    projectId: 'your-project-id'
  });

  // Step 2: Initiate X OAuth sign-in
  // User will be redirected to X to complete their login
  // After login, they will be redirected back to your app, and the login
  // process will be completed automatically by the SDK
  try {
    void signInWithOAuth("x");
  } catch (error) {
    console.error("Failed to sign in with X:", error);
  }
  ```

  ```typescript Error handling theme={null}
  import { initialize, signInWithEmail, verifyEmailOTP, APIError } from '@coinbase/cdp-core';

  try {
    await initialize({
      projectId: 'your-project-id'
    });

    const { flowId } = await signInWithEmail({
      email: 'user@example.com'
    });

    // Handle OTP verification with retry logic
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const { user, isNewUser } = await verifyEmailOTP({
          flowId,
          otp: userProvidedOTP
        });

        // Success!
        console.log('Authentication successful:', user);
        break;
      } catch (error) {
        attempts++;
        if (error instanceof APIError) {
          console.error('API Error:', error.message);
          if (attempts >= maxAttempts) {
            console.error('Maximum attempts reached. Please request a new OTP.');
          }
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    }
  } catch (error) {
    if (error instanceof APIError) {
      // Handle specific API errors
      console.error('CDP API Error:', error.message);
      console.error('Error Type:', error.errorType);
    } else {
      console.error('Authentication failed:', error);
    }
  }
  ```

  ```typescript Session management theme={null}
  import { initialize, getCurrentUser, isSignedIn, signOut, onAuthStateChange } from '@coinbase/cdp-core';

  // Initialize must be called before any other methods
  await initialize({
    projectId: 'your-project-id'
  });

  // Check if user is already signed in
  const signedIn = await isSignedIn();
  if (signedIn) {
    const user = await getCurrentUser();
    console.log('User already authenticated:', user?.userId);
    console.log('EVM Accounts:', user?.evmAccounts);
  }

  // Listen for auth state changes
  onAuthStateChange((user) => {
    if (user) {
      console.log('User signed in:', user.userId);
    } else {
      console.log('User signed out');
    }
  });

  // Sign out when needed
  await signOut();
  ```
</CodeGroup>

<Warning>
  Always handle authentication errors gracefully. Common errors include:

  * Invalid or expired OTP codes
  * Rate limiting for too many attempts
  * Network connectivity issues
  * Invalid project configuration
</Warning>

## React Native Social Login configuration

OAuth authentication in React Native requires configuring a deep link callback URL:

<Steps>
  <Step title="Set up deep linking">
    Add a custom scheme to your `app.json`:

    ```json theme={null}
    {
      "expo": {
        "scheme": "my-app"
      }
    }
    ```

    See [Expo Linking docs](https://docs.expo.dev/linking/overview/#linking-to-your-app-from-other-apps-or-websites) for details.
  </Step>

  <Step title="Add callback URL to CDP Portal">
    Add your deep link (e.g., `my-app://oauth-callback`) to your [allowed domains](https://portal.cdp.coinbase.com/wallets/non-custodial/clients).
  </Step>

  <Step title="Configure the SDK">
    Add `nativeOAuthCallback` to your config:

    ```typescript theme={null}
    const cdpConfig: Config = {
      projectId: 'your-project-id',
      nativeOAuthCallback: 'my-app://oauth-callback',
      ethereum: { createOnLogin: 'smart' },
    };
    ```
  </Step>
</Steps>

The SDK uses `expo-web-browser` to automatically handle the OAuth redirect and callback. You don't need to add `Linking.addEventListener` or other deep link handling code.

## Server-side validation

Some developers take additional action (fetching additional data, starting asynchronous processes) based on a user having an active session. For security reasons, it is important that you check authentication status by validating the access token Coinbase grants a user when they log in.

<CodeGroup>
  ```tsx Access token retrieval using React hooks theme={null}
  import { useGetAccessToken, useIsSignedIn } from "@coinbase/cdp-hooks";
  import { useEffect, useState } from "react";

  export default function useServerSideAuth() {
    const { isSignedIn } = useIsSignedIn();
    const { getAccessToken } = useGetAccessToken();
    const [isServerSideAuthenticated, setIsServerSideAuthenticated] = useState<boolean>(false);

    // When the user signs in, we need to check if the user is authenticated on the server side.
    useEffect(() => {
      async function checkAuth() {
        if (!isSignedIn) {
          return;
        }
        // Retrieve the access token
        const accessToken = await getAccessToken();

        // Send the access token to your server to check if the user is authenticated.
        const response = await fetch("/api/check-auth", {
          method: "POST",
          body: JSON.stringify({
            accessToken,
          }),
        });
        const { isAuthenticated, endUser, error } = await response.json();
        if (isAuthenticated) {
          setIsServerSideAuthenticated(true);
          console.log("endUser", endUser);
        } else {
          setIsServerSideAuthenticated(false);
          console.log("error", error);
        }
      }
      void checkAuth();
    }, [isSignedIn, getAccessToken]);

    return isServerSideAuthenticated;
  }
  ```

  ```typescript Access token retrieval using direct methods theme={null}
  import { initialize, getAccessToken, isSignedIn } from '@coinbase/cdp-core';

  // Initialize must be called before any other methods
  await initialize({
    projectId: 'your-project-id'
  });

  // Check if user is already signed in
  const signedIn = await isSignedIn();
  if (signedIn) {
    // Get the user's access token
    const accessToken = await getAccessToken();

    // Send the access token to your server to check if the user is authenticated.
    const response = await fetch('/api/check-auth', {
      method: 'POST',
      body: JSON.stringify({
        accessToken,
      }),
    });
    const { isAuthenticated, endUser, error } = await response.json();
  }
  ```

  ```typescript Validating access token server-side theme={null}
  // Next.js route for /api/check-auth
  import { NextRequest, NextResponse } from 'next/server';
  import { CdpClient } from "@coinbase/cdp-sdk";

  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    throw new Error('CDP_API_KEY_ID and CDP_API_KEY_SECRET must be set');
  }

  const cdpClient = new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
  });

  export async function POST(request: NextRequest) {
    try {
      const body = await request.json();
      const { accessToken } = body;

      if (!accessToken) {
        return NextResponse.json(
          { isAuthenticated: false, error: 'Missing accessToken parameter' },
          { status: 400 }
        );
      }

      const endUser = await cdpClient.endUser.validateAccessToken({
          accessToken,
      });

      // If we reach here, the token is valid
      return NextResponse.json({ isAuthenticated: true, endUser });
    } catch (error) {
      const errorMessage =
        (error as { errorMessage?: string }).errorMessage ??
        (error as { message?: string }).message ??
        "Unknown error";
      // Any error means the token is invalid or there was an authentication issue
      return NextResponse.json({ isAuthenticated: false, error: errorMessage });
    }
  }
  ```
</CodeGroup>

## What to read next

* **[Authentication Methods](/wallets/authentication/overview)**: Learn about email OTP, SMS OTP, and social login options
* **[React Hooks](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks)**: Pre-built hooks for authentication and wallet management
* **[React Components](/wallets/client-side-development/react-components)**: Ready-to-use UI components including AuthButton
* **[Session Management](/wallets/authentication/session-management)**: Understand session lifecycle and token management
* **[Best Practices](/wallets/authentication/best-practices)**: Security recommendations and choosing the right approach
