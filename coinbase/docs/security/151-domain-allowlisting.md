> Coinbase CDP docs — **security** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Domain Allowlisting

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

The Coinbase Developer Platform (CDP) [Portal](https://portal.cdp.coinbase.com) requires you configure which domains are authorized to access CDP APIs. These domains are configured using Cross-Origin Resource Sharing (CORS), ensuring your users are protected while maintaining a seamless experience.

<Accordion title="More on CORS">
  CORS (Cross-Origin Resource Sharing) is a browser security mechanism that controls access between different web origins. An origin is defined by the combination of protocol (http/https), domain, and port.

  By default, browsers enforce the **same-origin policy**, blocking requests between different origins for security. CORS provides a way to safely relax this restriction:

  * **Without CORS**: Your website at `https://myapp.com` cannot access APIs at `https://api.cdp.coinbase.com`
  * **With CORS**: The API server explicitly allows specific origins, enabling secure cross-origin communication

  Learn more about CORS fundamentals in the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS).
</Accordion>

By properly configuring your user wallet domains, you create a secure boundary that ensures only authorized applications can access our APIs, preventing malicious websites from exploiting your wallet integration, and protecting your users from cross-site scripting attacks.

## Example

Let's walk through a practical example:

1. A dapp at `https://app.developer.com` wants to send a POST request to `https://api.cdp.coinbase.com/embedded-wallet-api/projects/{projectId}` (e.g., to create a wallet).
2. When Coinbase Developer Platform (CDP) receives the request, it will look up the list of allowed domains for the given project ID.
3. CDP queries its database and sees that the developer has configured `https://app.developer.com` as an allowed domain for the project.
4. CDP responds to the API with the following header set, allowing the response to return successfully:

```
Access-Control-Allow-Origin: https://app.developer.com
```

## How to configure domains

<Steps titleSize="p">
  <Step title="Access CDP Portal">
    Navigate to the [Domains Configuration](https://portal.cdp.coinbase.com/wallets/non-custodial/clients) in CDP Portal:
  </Step>

  <Step title="Add your domain">
    Click **Add domain** and enter your allowed domain and/or port (e.g., `https://yourdapp.com` in production or `http://localhost:3000` for local development):

    <Warning>
      Do not use `localhost` for production use. Malicious apps running locally could impersonate your frontend and abuse your project credentials.
    </Warning>

    <Accordion title="Domain format requirements">
      * Domains must be of the form `<scheme>://<host>:<port>` or browser extension URLs
        * `<scheme>` must be either `http` or `https`
        * `<host>` must be a valid hostname
        * `:<port>` is optional for ports 80 (http) and 443 (https), but required for all other ports (e.g., `http://localhost:3000`)
      * Browser extension URLs are also supported:
        * `chrome-extension://<extension-id>` for Chrome extensions
        * `moz-extension://<extension-id>` for Firefox extensions
        * `safari-web-extension://<extension-id>` for Safari extensions
        * When using browser extension schemes, no port or path is allowed - only the unique extension ID following the scheme
      * **Mobile app Deep Link URLs** are supported and required for React Native OAuth/social login flows:
        * Format: `<scheme>://<path>`
        * `<scheme>` must match the scheme defined in your React Native app configuration (e.g., `app.json` or `app.config.js`)
        * `<path>` can be any path you choose (e.g., `my-app://callback`, `mycompany://oauth`, `myapp://auth/redirect`)
      * Wildcard subdomains are supported for `http`/`https` origins:
        * A single `*` is allowed anywhere within one subdomain segment
        * Examples: `https://*.example.com`, `https://test-*-sub.example.com`, `https://preview-*-abc123.vercel.app`
        * Not allowed: `https://*example.com` (wildcard must be in its own subdomain segment, not the registrable domain), `https://*.com`, multiple `*` in one hostname
      * Maximum of 50 domains allowed per project
    </Accordion>
  </Step>

  <Step title="Save your changes">
    Click **Add domain** to save. Your allowed domains will appear in the dashboard, and changes will take effect immediately:

    <Tip>
      Add all domains where your app will run: development, staging, and production.
    </Tip>
  </Step>
</Steps>

## What to read next

* **[Quickstart Guide](/wallets/quickstart/user-auth)**: Build your first user wallet app in under 10 minutes
* **[React Hooks Reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks)**: Learn about available hooks like `useSignInWithEmail`, `useEvmAddress`, `useSendSolanaTransaction`, and more
* **[React Components Guide](/wallets/client-side-development/react-components)**: Explore pre-built components for authentication, wallet management, and transactions
