> Coinbase CDP docs — **onramp-offramp** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Security Requirements

## Overview

To prevent unauthorized usage of onramp sessions, all applications must implement proper security measures when integrating with CDP APIs. This ensures that onramp experiences can only be accessed through approved, compliant applications with authenticated users.

<Warning>
  **Security is Critical**: Implementing proper CORS headers and additional authentication measures is essential for maintaining the security and integrity of the onramp service. Failure to implement these measures may result in unauthorized access to your integration. You are responsible and will be liable for any misuse of your endpoints due to improper implementation of these security measures.
</Warning>

## CORS Protection Requirements

Any APIs that call our authenticated endpoints for **web based clients** must implement CORS headers:

* Only allow specific, approved origins that should have access to your integration. Do not set
  `Access-Control-Allow-Origin` to `*`.
* This prevents malicious websites from hijacking your APIs to create unauthorized onramp sessions

<Info>
  If your API is not expected to be called from browser-based clients (e.g. only called by mobile apps), ensure you do not return the `Access-Control-Allow-Origin` header. This will deny all cross-origin browser requests.
</Info>

<Info>
  Learn more about [CORS implementation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) from Mozilla's comprehensive guide.
</Info>

**Example CORS Configuration:**

```http theme={null}
Access-Control-Allow-Origin: https://yourapprovedomain.com
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Strongly Recommended Security Measures

While CORS provides essential protection, implementing additional authentication layers significantly enhances the security of your onramp integration.

### Authenticated Endpoints

**Require user authentication before creating onramp sessions.** This ensures that only legitimate, authenticated users can initiate onramp experiences.

#### Wallet Signature Authentication

Implement wallet signature verification where users sign a unique message (containing wallet address and timestamp) with their private key. This proves wallet ownership without exposing sensitive keys, making it cryptographically impossible for attackers to impersonate legitimate users.

#### Traditional User Login

For applications with existing user accounts, require standard JWT or session-based authentication before allowing session token creation. This leverages your existing authentication infrastructure and user management systems.

<Info>
  **Security Enhancement**: Combining multiple authentication methods provides the strongest protection against unauthorized onramp usage.
</Info>

## Domain Allowlist

Onramp and Offramp use a product-specific **Domain Allowlist** under **Payments → Onramp & Offramp** in the [CDP Portal](https://portal.cdp.coinbase.com/products/onramp). Configure this allowlist when you:

* Pass a `redirectUrl` to [Coinbase-hosted Onramp](/onramp/coinbase-hosted-onramp/generating-onramp-url), the [Create Onramp Session API](/api-reference/v2/rest-api/onramp/create-an-onramp-session), or [Offramp](/onramp/offramp/generating-offramp-url).
* Embed a payment link returned by the [Create Onramp Order API](/api-reference/v2/rest-api/onramp/create-an-onramp-order) in a web app. You must register the domain, pass it in the order request, and complete the [Headless Onramp web app requirements](/onramp/headless-onramp/overview#web-app-requirements).

If a `redirectUrl` doesn't match an entry in the Onramp and Offramp allowlist, the redirect is silently ignored. The transaction still completes, but the user is not sent back to your app.

Supported formats:

* `https://app.com`: matches all sub-paths (e.g. `https://app.com/*`)
* `https://*.domain.com`: wildcard subdomains (`https://` and `http://` only)
* `custom-scheme://path`: mobile deep links (wildcard not supported)

**Display Name (optional)**

Set your app's display name on the CDP Portal to improve the redirect experience. It appears on the order preview, post-purchase redirect countdown, and manual redirect button.

See the [Onramp demo app](/get-started/demo-apps/starter/onramp-demo-app) for a reference implementation.

## Additional Resources

* [CORS MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) — Comprehensive CORS implementation guide

<Info>
  **Need Help?** Join the **#onramp** channel in our [CDP Discord](https://discord.com/invite/cdp) community for implementation support and best practices.
</Info>
