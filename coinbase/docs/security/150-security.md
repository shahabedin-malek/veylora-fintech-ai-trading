> Coinbase CDP docs — **security** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Security

## Overview

CDP Wallets are protected by a [**Trusted** Execution Environment](https://en.wikipedia.org/wiki/Trusted_execution_environment) (TEE), a highly isolated compute environment for sensitive cryptographic operations such as private key generation and transaction signing.

The TEE runs on [AWS Nitro Enclaves](https://aws.amazon.com/ec2/nitro/nitro-enclaves/), with **no persistent storage**, **no interactive access**, and **no external networking**. This means even root or admin users cannot access or SSH into the enclave.

Private key operations happen inside the enclave boundary and are not externally accessible to CDP, AWS, or other infrastructure components.

## TEE architecture

The following diagram shows the TEE architecture:

<Frame>
  <img src="https://mintcdn.com/coinbase-prod/HI--6uvOvA1sWH4q/images/tee-architecture.png?fit=max&auto=format&n=HI--6uvOvA1sWH4q&q=85&s=f8831b207654e697ee05fb9d5839c68d" width="600" style={{ border: '1px solid lightgrey' }} data-path="images/tee-architecture.png" />
</Frame>

### How it works

1. Incoming requests are authenticated with wallet credentials:
   * API key authentication uses a developer-managed Wallet Secret.
   * End-user authentication uses a Temporary Wallet Secret.
2. After request validation, payloads are forwarded to the enclave over [VSOCK](https://man7.org/linux/man-pages/man7/vsock.7.html), the only data path to and from the enclave.
3. The enclave performs sensitive operations, including auth signature verification, private key generation, and transaction signing. Private keys are encrypted/decrypted **inside the enclave** and **never leave the enclave in plaintext**.
4. The resulting payload is sent back over VSOCK.
5. The CDP API returns the result to the client.

## Wallet authentication credentials

Wallet credentials are used to authorize requests to CDP Wallets.

These credentials are asymmetric private keys based on [ECDSA](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-5.pdf#page=29) using the [**secp256r1**](https://www.secg.org/sec2-v2.pdf#page=13) (P-256) elliptic curve.

There are two credential types:

1. **Temporary Wallet Secret (end-user auth):** Device-specific key material generated and stored locally on end-user devices.
2. **Wallet Secret (API key auth):** Developer-managed, rotatable key material used for backend-authorized operations.

Read more about using Wallet Secrets in our [API Reference documentation](/api-reference/v2/authentication#wallet-secret).

<Info>
  For end-user wallet lifecycle and UX guidance, see [Non-custodial Wallets: Overview](/wallets/overview). Temporary Wallet Secrets play the same request-authentication role for end-user auth that Wallet Secrets play for API key auth.
</Info>

### 2FA for API key authentication

To strengthen protection for developer-managed credentials, enable [two-factor authentication](/wallets/security-and-policies/security-overview#2fa-management) (2FA).

Supported methods include physical security keys, passkeys, authenticator apps, security push notifications, and trusted contacts.

<Warning>
  Avoid SMS as a primary 2FA method. Prefer a physical security key or passkey.
</Warning>

### Lost access

If you lose access to a developer-managed Wallet Secret, delete the old secret and generate a new one in CDP Portal. See [Wallet Secret Rotation](/wallets/security-and-policies/security-overview) for full recovery and rotation steps.

## Compliance

CDP Wallets are built on Coinbase's trusted, compliant crypto infrastructure, helping enterprises meet regulatory requirements out of the box.

### OFAC sanctions screening

All transfers are automatically screened against the OFAC sanctions list. Transfers to sanctioned addresses are blocked before they are submitted onchain, with no additional integration work required.

This built-in compliance makes CDP Wallets well-suited for enterprise use cases including banks, brokerages, payment service providers, fintechs, and other regulated institutions that require robust compliance controls as a foundation.

## What to read next

* [Authentication Methods](/wallets/authentication/overview): Learn when to use API key auth vs end-user auth.
* [Non-custodial Wallets: Overview](/wallets/overview): Learn the end-user wallet model and Temporary Wallet Secrets.
