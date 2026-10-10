> Coinbase CDP docs — **security** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# First-Party Cookies

> Serve non-custodial user wallet session cookies from your own subdomain so refresh tokens stay in first-party HttpOnly cookies across all major browsers.

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

<Tags tags={["User Wallet"]} />

<Info>
  First-party cookie support is in limited access. [Request access](https://docs.google.com/forms/d/e/1FAIpQLSeSndY1RhXaXqk2TExCRiwXLihkEexY1lvzt_zf0yav7fLZvg/viewform) to have it enabled for your project before you start.
</Info>

## Overview

Non-custodial user wallet sessions use a [refresh token](/wallets/authentication/session-management#how-session-tokens-work) to keep users signed in. CDP stores that token in one of two ways: an `HttpOnly` cookie, which page scripts cannot read, or browser `localStorage` as a fallback.

By default CDP uses the `HttpOnly` cookie, scoped to CDP's domain (`api.cdp.coinbase.com`). When your app runs on its own domain, that cookie is third-party, and browsers that block third-party cookies (Safari, Firefox, Brave, Chrome in Incognito) fall back to storing the refresh token in `localStorage`.

First-party cookie support lets you serve that cookie from a subdomain of your own site (for example `auth.myapp.com`), so the refresh token stays in an `HttpOnly` cookie on every major browser.

<Note>
  The cookie is issued with `SameSite=Lax`, `HttpOnly`, and `Secure`. These attributes are fixed and are not configurable.
</Note>

## How it works

You add DNS records at your provider that route a subdomain you own to CDP and prove you control it. CDP issues and renews the TLS certificate for the subdomain and serves authentication requests on it, so the session cookie is issued as first-party.

Once the domain is active, the SDK detects it automatically from your project configuration and sends authentication requests to `https://<your-subdomain>/...`. You do not change any application code.

## Requirements

* The cookie domain must be a **subdomain** (for example `auth.myapp.com`). Apex domains such as `myapp.com` are not supported.
* A project can have one active cookie domain at a time.
* You need access to your DNS provider to add the records CDP returns.

## Setup

<Steps titleSize="p">
  <Step title="Request access">
    First-party cookie support is in limited access. [Request access](https://docs.google.com/forms/d/e/1FAIpQLSeSndY1RhXaXqk2TExCRiwXLihkEexY1lvzt_zf0yav7fLZvg/viewform) to have it enabled. Once access is confirmed, the first-party cookie settings appear in your project's wallet security configuration in [CDP Portal](https://portal.cdp.coinbase.com).
  </Step>

  <Step title="Register your subdomain">
    In CDP Portal, open your project's wallet security settings and add your cookie domain (for example `auth.myapp.com`). Portal returns the DNS records you need to publish.
  </Step>

  <Step title="Add the DNS records">
    Add the returned records at your DNS provider. **Copy the exact host and value from Portal, not the examples below.** The verification token, certificate delegation target, and routing host are specific to your project.

    The records below are illustrative examples only:

    | Type | Example host | Example value | Purpose |
    | - | - | - | - |
    | TXT | `_cdp-verification.auth.myapp.com` | `cdp-verify=EXAMPLE-TOKEN` | Proves you own the subdomain |
    | CNAME | `_acme-challenge.auth.myapp.com` | `auth.myapp.com.EXAMPLE-ID.dcv.cloudflare.com` | Lets CDP issue and auto-renew the TLS certificate |
    | CNAME | `auth.myapp.com` | `EXAMPLE-PROXY-HOST` | Routes authentication traffic to CDP |
  </Step>

  <Step title="Wait for verification">
    CDP polls DNS every few minutes and moves the domain to `active` once the records resolve. Because of DNS propagation, verification usually completes within minutes but can take a few hours. A domain that is not verified within 72 hours is marked `failed`; delete it, correct the DNS records, and register the domain again.
  </Step>
</Steps>

## DNS and verification

The three records serve distinct roles:

* **Ownership**: the `_cdp-verification.<subdomain>` TXT record carries a token that proves you control the subdomain. CDP checks for it before issuing cookies on your domain.
* **TLS**: the `_acme-challenge.<subdomain>` CNAME delegates certificate validation to CDP, so the certificate for your subdomain is issued and renewed automatically without you republishing a challenge.
* **Routing**: the CNAME on the subdomain itself points traffic at CDP's proxy, which terminates TLS and sets the first-party cookie.

## Status lifecycle

<AccordionGroup>
  <Accordion title="pending">
    The domain is registered and awaiting DNS verification. Make sure all records from Portal are published exactly as shown. CDP rechecks every few minutes.
  </Accordion>

  <Accordion title="active">
    DNS is verified and first-party cookies are being issued on your subdomain. CDP rechecks active domains periodically to confirm the records are still in place.
  </Accordion>

  <Accordion title="failed">
    The verification records were not found within 72 hours. Delete the failed domain, confirm the records are correct and published, then register it again. A failed domain must be removed before you can register a new one.
  </Accordion>

  <Accordion title="deactivated">
    The domain was active but its verification record was later removed, so cookie issuance stopped and sessions revert to the default CDP domain. To resume first-party cookies, delete the deactivated entry and register the domain again. Like a failed domain, it must be removed before you can register a new one.
  </Accordion>
</AccordionGroup>

## Replacing or removing a domain

To rotate to a new subdomain, register the replacement while the current domain is still active. The two coexist until the new one verifies, then it takes over. A `failed` or `deactivated` domain stays listed until you delete it and must be removed before you can register another.

Removing the active domain reverts sessions to the default CDP domain immediately. The DNS records you added become inert and can be safely deleted from your provider.

## What to read next

* **[Session Management](/wallets/authentication/session-management)**: How refresh and access tokens keep users signed in.
* **[Domain Allowlisting](/wallets/security-and-policies/domain-allowlisting)**: Configure which origins can call CDP APIs for your project.
