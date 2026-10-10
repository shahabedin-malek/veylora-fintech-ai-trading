> Coinbase CDP docs — **onramp-offramp** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Onramp Verification

The Onramp Verification APIs let Coinbase manage OTP verification of a user's phone number and email on your behalf. Instead of running your own OTP infrastructure, you call these APIs to verify both contact channels and pass the resulting verification IDs to the [Create Onramp Order API](/api-reference/v2/rest-api/onramp/create-an-onramp-order).

<Info>
  Onramp Verification is available for Guest Checkout (Headless Onramp) integrations. Both phone number and email must be verified before creating an order. This API is an alternative to self-managed OTP verification — you do not need both approaches.
</Info>

<Warning>
  **Access to these APIs requires allowlisting.** During Headless Onramp onboarding, contact the Onramp team to enable Onramp-managed verification for your application. You can build and test the full flow in [sandbox](#sandbox-testing) without allowlisting.
</Warning>

## How it works

<Steps>
  <Step title="Initiate verification">
    Call [POST /v2/onramp/verifications](/api-reference/v2/rest-api/onramp/initiate-onramp-verification) with the channel and the user's phone number or email. Coinbase sends a 6-digit code and returns a `verificationId`. The code is valid for 10 minutes.
  </Step>

  <Step title="Submit the OTP code">
    Collect the code from the user and call [POST /v2/onramp/verifications/\{verificationId}/submit](/api-reference/v2/rest-api/onramp/submit-onramp-verification). On success the verification is marked verified and is valid for 60 days.
  </Step>

  <Step title="Create the order">
    Pass the returned verification IDs — `smsVerificationId` for phone, `emailVerificationId` for email — to the [Create Onramp Order API](/api-reference/v2/rest-api/onramp/create-an-onramp-order). Onramp validates the server-side verification records for both channels.
  </Step>
</Steps>

## Integration flow

### 1. Initiate verification

```bash theme={null}
cdpcurl -X POST 'https://api.cdp.coinbase.com/platform/v2/onramp/verifications' \
  -k ~/Downloads/cdp_api_key.json \
  -d '{
    "channel": "sms",
    "destination": "+12055555555"
  }'
```

`channel` is `sms` or `email`. `destination` is the phone number (E.164) or email address to send the code to.

**Response:**

```json theme={null}
{
  "verificationId": "onramp_verification_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "otpExpiresAt": "2025-04-24T00:10:00Z"
}
```

Persist the `verificationId` and prompt the user to enter the code before `otpExpiresAt`.

### 2. Submit the OTP code

```bash theme={null}
cdpcurl -X POST 'https://api.cdp.coinbase.com/platform/v2/onramp/verifications/onramp_verification_a1b2c3d4-e5f6-7890-abcd-ef1234567890/submit' \
  -k ~/Downloads/cdp_api_key.json \
  -d '{
    "otpCode": "123456"
  }'
```

The destination does not need to be re-sent — Onramp uses the value captured at initiation.

**Response:**

```json theme={null}
{
  "verificationId": "onramp_verification_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "verificationExpiresAt": "2025-06-23T00:00:00Z"
}
```

The `verificationId` is valid for 60 days and must be re-verified afterward.

### 3. Create the order

After verifying both channels, pass the verification IDs when creating an order. Use `smsVerificationId` for the phone verification and `emailVerificationId` for the email verification.

```bash theme={null}
cdpcurl -X POST 'https://api.cdp.coinbase.com/platform/v2/onramp/orders' \
  -k ~/Downloads/cdp_api_key.json \
  -d '{
    "smsVerificationId": "onramp_verification_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "emailVerificationId": "onramp_verification_b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "...": "remaining order fields"
  }'
```

## Sandbox testing

You can exercise the full verification flow in sandbox **without being on the allowlist**, so you can integrate before production access is granted. Sandbox requests never send a real SMS or email and never touch a real user record.

### Sandbox values

| Input | Sandbox value |
| - | - |
| SMS `destination` | Any number prefixed with `+1000` (e.g. `+10005550100`) |
| Email `destination` | Any address ending in `@sandbox.test` (e.g. `tester@sandbox.test`) |
| `otpCode` (on submit) | `000000` |

### Sandbox walkthrough

**1. Initiate with a sandbox phone number:**

```bash theme={null}
cdpcurl -X POST 'https://api.cdp.coinbase.com/platform/v2/onramp/verifications' \
  -k ~/Downloads/cdp_api_key.json \
  -d '{
    "channel": "sms",
    "destination": "+10005550100"
  }'
```

The response returns a sandbox `verificationId` (recognizable by the `onramp_verification_00000000-` prefix):

```json theme={null}
{
  "verificationId": "onramp_verification_00000000-a1b2-c3d4-e5f6-7890abcdef12",
  "otpExpiresAt": "2025-04-24T00:10:00Z"
}
```

**2. Submit the sandbox OTP code (`000000`):**

```bash theme={null}
cdpcurl -X POST 'https://api.cdp.coinbase.com/platform/v2/onramp/verifications/onramp_verification_00000000-a1b2-c3d4-e5f6-7890abcdef12/submit' \
  -k ~/Downloads/cdp_api_key.json \
  -d '{
    "otpCode": "000000"
  }'
```

```json theme={null}
{
  "verificationId": "onramp_verification_00000000-a1b2-c3d4-e5f6-7890abcdef12",
  "verificationExpiresAt": "2025-06-23T00:00:00Z"
}
```

**3. Test the error path** — submitting any code other than `000000` returns an error:

```bash theme={null}
cdpcurl -X POST '.../submit' \
  -k ~/Downloads/cdp_api_key.json \
  -d '{ "otpCode": "999999" }'
```

```json theme={null}
{
  "errorType": "otp_verification_code_invalid",
  "errorMessage": "OTP verification failed"
}
```

## Error reference

| HTTP | Cause | Resolution |
| - | - | - |
| 400 | Invalid channel, destination, or OTP code | Check `errorMessage` and the request fields. |
| 401 | Missing or invalid API key, or app not allowlisted | Verify your API key. Contact the Onramp team to be allowlisted. |
| 404 | Verification ID not found (submit) | Ensure you are using the `verificationId` returned by initiate. |
| 429 | Rate limit exceeded | Back off and retry with exponential backoff. |

<CardGroup cols={2}>
  <Card title="POST /v2/onramp/verifications" icon="paper-plane" href="/api-reference/v2/rest-api/onramp/initiate-onramp-verification">
    Full API reference for initiating a verification.
  </Card>

  <Card title="POST /v2/onramp/verifications/\{verificationId\}/submit" icon="circle-check" href="/api-reference/v2/rest-api/onramp/submit-onramp-verification">
    Full API reference for submitting an OTP code.
  </Card>
</CardGroup>
