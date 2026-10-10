> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Verification

Verify webhook signatures to ensure incoming events are authentic.

## Prerequisites

You will need:

* A webhook subscription secret from [Subscriptions](/webhooks/transfers/subscriptions)
* Access to the raw, unmodified request body in your webhook handler
* The `X-Hook0-Signature` request header

## Verify signatures

<Warning>
  Verify webhook signatures to ensure that requests are authentic. This protects your application from forged webhooks and potential security threats.
</Warning>

### How signature verification works

When you create a webhook subscription, the response includes a `secret`. This secret is used to verify that incoming webhooks are authentic.

Each webhook request includes an `X-Hook0-Signature` header containing:

* `t` field - the timestamp
* `h` field - list of headers included in the signature
* `v1` field - the signature

### Verification implementation

Here's an example of how to verify webhook signatures:

<CodeGroup>
  ```typescript TypeScript lines wrap theme={null}
  import crypto from "crypto";

  type HeadersMap = Record<string, string>;

  function verifyWebhookSignature(
    payload: string,
    signatureHeader: string,
    secret: string,
    headers: HeadersMap,
    maxAgeMinutes = 5
  ): boolean {
    try {
      const elements = signatureHeader.split(",");
      const timestamp = elements.find((e) => e.startsWith("t="))?.split("=")[1] ?? "";
      const headerNames = elements.find((e) => e.startsWith("h="))?.split("=")[1] ?? "";
      const providedSignature = elements.find((e) => e.startsWith("v1="))?.split("=")[1] ?? "";

      const headerNameList = headerNames.split(" ");
      const headerValues = headerNameList.map((name) => headers[name] ?? "").join(".");

      const signedPayload = `${timestamp}.${headerNames}.${headerValues}.${payload}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(signedPayload, "utf8")
        .digest("hex");

      const signaturesMatch = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(providedSignature, "hex")
      );

      const webhookTime = parseInt(timestamp, 10) * 1000;
      const currentTime = Date.now();
      const ageMinutes = (currentTime - webhookTime) / (1000 * 60);

      if (ageMinutes > maxAgeMinutes) {
        console.error(
          `Webhook timestamp exceeds maximum age: ${ageMinutes.toFixed(1)} minutes > ${maxAgeMinutes} minutes`
        );
        return false;
      }

      return signaturesMatch;
    } catch (error) {
      console.error("Webhook verification error:", error);
      return false;
    }
  }
  ```

  ```python Python lines wrap theme={null}
  import hashlib
  import hmac
  import time

  def verify_webhook_signature(payload, signature_header, secret, headers, max_age_minutes=5):
      """Verify webhook signature and timestamp."""
      try:
          elements = signature_header.split(",")
          timestamp = next(e for e in elements if e.startswith("t=")).split("=", 1)[1]
          header_names = next(e for e in elements if e.startswith("h=")).split("=", 1)[1]
          provided_signature = next(e for e in elements if e.startswith("v1=")).split("=", 1)[1]

          header_name_list = header_names.split(" ")
          header_values = ".".join(headers.get(name, "") for name in header_name_list)

          signed_payload = f"{timestamp}.{header_names}.{header_values}.{payload}"
          expected_signature = hmac.new(
              secret.encode("utf-8"),
              signed_payload.encode("utf-8"),
              hashlib.sha256,
          ).hexdigest()

          signatures_match = hmac.compare_digest(expected_signature, provided_signature)

          webhook_time_ms = int(timestamp) * 1000
          current_time_ms = int(time.time() * 1000)
          age_minutes = (current_time_ms - webhook_time_ms) / (1000 * 60)

          if age_minutes > max_age_minutes:
              print(
                  f"Webhook timestamp exceeds maximum age: {age_minutes:.1f} minutes > {max_age_minutes} minutes"
              )
              return False

          return signatures_match
      except Exception as error:
          print(f"Webhook verification error: {error}")
          return False
  ```

  ```go Go lines wrap theme={null}
  package main

  import (
  	"crypto/hmac"
  	"crypto/sha256"
  	"encoding/hex"
  	"fmt"
  	"strconv"
  	"strings"
  	"time"
  )

  func verifyWebhookSignature(payload, signatureHeader, secret string, headers map[string]string, maxAgeMinutes int) bool {
  	elements := strings.Split(signatureHeader, ",")
  	var timestamp, headerNames, providedSignature string
  	for _, element := range elements {
  		if strings.HasPrefix(element, "t=") {
  			timestamp = strings.TrimPrefix(element, "t=")
  		}
  		if strings.HasPrefix(element, "h=") {
  			headerNames = strings.TrimPrefix(element, "h=")
  		}
  		if strings.HasPrefix(element, "v1=") {
  			providedSignature = strings.TrimPrefix(element, "v1=")
  		}
  	}

  	headerNameList := strings.Split(headerNames, " ")
  	headerValues := make([]string, 0, len(headerNameList))
  	for _, name := range headerNameList {
  		headerValues = append(headerValues, headers[name])
  	}

  	signedPayload := fmt.Sprintf("%s.%s.%s.%s", timestamp, headerNames, strings.Join(headerValues, "."), payload)
  	mac := hmac.New(sha256.New, []byte(secret))
  	mac.Write([]byte(signedPayload))
  	expectedSignature := hex.EncodeToString(mac.Sum(nil))

  	signaturesMatch := hmac.Equal([]byte(expectedSignature), []byte(providedSignature))

  	webhookTime, err := strconv.ParseInt(timestamp, 10, 64)
  	if err != nil {
  		return false
  	}
  	ageMinutes := float64(time.Now().UnixMilli()-webhookTime*1000) / (1000 * 60)
  	if ageMinutes > float64(maxAgeMinutes) {
  		fmt.Printf("Webhook timestamp exceeds maximum age: %.1f minutes > %d minutes\n", ageMinutes, maxAgeMinutes)
  		return false
  	}

  	return signaturesMatch
  }
  ```

  ```ruby Ruby lines wrap theme={null}
  require "openssl"

  def verify_webhook_signature(payload, signature_header, secret, headers, max_age_minutes = 5)
    elements = signature_header.split(",")
    timestamp = elements.find { |e| e.start_with?("t=") }&.split("=", 2)&.last.to_s
    header_names = elements.find { |e| e.start_with?("h=") }&.split("=", 2)&.last.to_s
    provided_signature = elements.find { |e| e.start_with?("v1=") }&.split("=", 2)&.last.to_s

    header_values = header_names.split(" ").map { |name| headers[name] || "" }.join(".")
    signed_payload = "#{timestamp}.#{header_names}.#{header_values}.#{payload}"
    expected_signature = OpenSSL::HMAC.hexdigest("SHA256", secret, signed_payload)

    signatures_match = expected_signature.bytesize == provided_signature.bytesize &&
      expected_signature.bytes.zip(provided_signature.bytes).reduce(0) { |acc, (a, b)| acc | (a ^ b) }.zero?

    webhook_time = timestamp.to_i * 1000
    age_minutes = (Time.now.to_i * 1000 - webhook_time) / (1000.0 * 60.0)
    if age_minutes > max_age_minutes
      puts "Webhook timestamp exceeds maximum age: #{age_minutes.round(1)} minutes > #{max_age_minutes} minutes"
      return false
    end

    signatures_match
  rescue StandardError => error
    puts "Webhook verification error: #{error}"
    false
  end
  ```

  ```php PHP lines wrap theme={null}
  <?php
  function verifyWebhookSignature($payload, $signatureHeader, $secret, $headers, $maxAgeMinutes = 5): bool
  {
      $elements = explode(",", $signatureHeader);
      $timestamp = "";
      $headerNames = "";
      $providedSignature = "";

      foreach ($elements as $element) {
          if (str_starts_with($element, "t=")) {
              $timestamp = substr($element, 2);
          }
          if (str_starts_with($element, "h=")) {
              $headerNames = substr($element, 2);
          }
          if (str_starts_with($element, "v1=")) {
              $providedSignature = substr($element, 3);
          }
      }

      $headerNameList = explode(" ", $headerNames);
      $headerValues = array_map(
          fn($name) => $headers[$name] ?? "",
          $headerNameList
      );

      $signedPayload = $timestamp . "." . $headerNames . "." . implode(".", $headerValues) . "." . $payload;
      $expectedSignature = hash_hmac("sha256", $signedPayload, $secret);

      $signaturesMatch = hash_equals($expectedSignature, $providedSignature);

      $webhookTimeMs = intval($timestamp) * 1000;
      $currentTimeMs = intval(microtime(true) * 1000);
      $ageMinutes = ($currentTimeMs - $webhookTimeMs) / (1000 * 60);

      if ($ageMinutes > $maxAgeMinutes) {
          echo "Webhook timestamp exceeds maximum age: {$ageMinutes} minutes > {$maxAgeMinutes} minutes\n";
          return false;
      }

      return $signaturesMatch;
  }
  ```

  ```java Java lines wrap theme={null}
  import java.nio.charset.StandardCharsets;
  import java.security.MessageDigest;
  import java.time.Instant;
  import java.util.Arrays;
  import java.util.HashMap;
  import java.util.Map;
  import javax.crypto.Mac;
  import javax.crypto.spec.SecretKeySpec;

  public class WebhookVerifier {
      public static boolean verifyWebhookSignature(
          String payload,
          String signatureHeader,
          String secret,
          Map<String, String> headers,
          int maxAgeMinutes
      ) {
          try {
              String[] elements = signatureHeader.split(",");
              String timestamp = "";
              String headerNames = "";
              String providedSignature = "";
              for (String element : elements) {
                  if (element.startsWith("t=")) {
                      timestamp = element.substring(2);
                  } else if (element.startsWith("h=")) {
                      headerNames = element.substring(2);
                  } else if (element.startsWith("v1=")) {
                      providedSignature = element.substring(3);
                  }
              }

              String[] headerNameList = headerNames.split(" ");
              StringBuilder headerValues = new StringBuilder();
              for (int i = 0; i < headerNameList.length; i++) {
                  if (i > 0) {
                      headerValues.append(".");
                  }
                  headerValues.append(headers.getOrDefault(headerNameList[i], ""));
              }

              String signedPayload = String.join(".", timestamp, headerNames, headerValues.toString(), payload);
              Mac mac = Mac.getInstance("HmacSHA256");
              mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
              byte[] expectedBytes = mac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8));
              String expectedSignature = bytesToHex(expectedBytes);

              boolean signaturesMatch = MessageDigest.isEqual(
                  expectedSignature.getBytes(StandardCharsets.UTF_8),
                  providedSignature.getBytes(StandardCharsets.UTF_8)
              );

              long webhookTimeMs = Long.parseLong(timestamp) * 1000;
              long currentTimeMs = Instant.now().toEpochMilli();
              double ageMinutes = (currentTimeMs - webhookTimeMs) / (1000.0 * 60.0);
              if (ageMinutes > maxAgeMinutes) {
                  System.out.printf(
                      "Webhook timestamp exceeds maximum age: %.1f minutes > %d minutes%n",
                      ageMinutes,
                      maxAgeMinutes
                  );
                  return false;
              }

              return signaturesMatch;
          } catch (Exception error) {
              System.out.println("Webhook verification error: " + error);
              return false;
          }
      }

      private static String bytesToHex(byte[] bytes) {
          StringBuilder hex = new StringBuilder(bytes.length * 2);
          for (byte b : bytes) {
              hex.append(String.format("%02x", b));
          }
          return hex.toString();
      }

      public static void main(String[] args) {
          Map<String, String> headers = new HashMap<>();
          verifyWebhookSignature("payload", "t=0,h=host,v1=signature", "secret", headers, 5);
      }
  }
  ```
</CodeGroup>

And in your application:

<CodeGroup>
  ```typescript TypeScript lines wrap theme={null}
  import express from "express";

  const app = express();

  // Important: Get raw body for signature verification
  app.use(express.raw({ type: "application/json" }));

  app.post("/webhook", (req, res) => {
    const payload = req.body.toString();
    const signature = req.headers["x-hook0-signature"];
    const secret = process.env.WEBHOOK_SECRET ?? "";

    if (verifyWebhookSignature(payload, String(signature || ""), secret, req.headers as Record<string, string>)) {
      const event = JSON.parse(payload);

      // Handle your transfer event here

      res.status(200).send("OK");
      return;
    }

    res.status(400).send("Invalid signature");
  });
  ```

  ```python Python lines wrap theme={null}
  import os
  from flask import Flask, request

  app = Flask(__name__)

  @app.post("/webhook")
  def webhook():
      payload = request.get_data(as_text=True)
      signature = request.headers.get("X-Hook0-Signature", "")
      secret = os.environ.get("WEBHOOK_SECRET", "")

      if verify_webhook_signature(payload, signature, secret, request.headers):
          event = request.get_json()

          # Handle your transfer event here

          return ("OK", 200)

      return ("Invalid signature", 400)
  ```

  ```go Go lines wrap theme={null}
  package main

  import (
  	"io"
  	"net/http"
  	"os"
  	"strings"
  )

  func webhookHandler(w http.ResponseWriter, r *http.Request) {
  	payloadBytes, _ := io.ReadAll(r.Body)
  	payload := string(payloadBytes)
  	signature := r.Header.Get("X-Hook0-Signature")
  	secret := os.Getenv("WEBHOOK_SECRET")

  	headers := map[string]string{}
  	for name := range r.Header {
  	headers[strings.ToLower(name)] = r.Header.Get(name)
  	}
  if _, ok := headers["host"]; !ok {
  	headers["host"] = r.Host
  }

  	if verifyWebhookSignature(payload, signature, secret, headers, 5) {
  		// Handle your transfer event here
  		w.WriteHeader(http.StatusOK)
  		w.Write([]byte("OK"))
  		return
  	}

  	http.Error(w, "Invalid signature", http.StatusBadRequest)
  }
  ```

  ```ruby Ruby lines wrap theme={null}
  require "sinatra"

  post "/webhook" do
    payload = request.body.read
    signature = request.env["HTTP_X_HOOK0_SIGNATURE"] || ""
    secret = ENV.fetch("WEBHOOK_SECRET", "")
    headers = { "host" => request.host }

    if verify_webhook_signature(payload, signature, secret, headers)
      # Handle your transfer event here
      status 200
      body "OK"
    else
      status 400
      body "Invalid signature"
    end
  end
  ```

  ```php PHP lines wrap theme={null}
  <?php
  $payload = file_get_contents("php://input");
  $signature = $_SERVER["HTTP_X_HOOK0_SIGNATURE"] ?? "";
  $secret = getenv("WEBHOOK_SECRET") ?: "";

  $headers = [];
  foreach ($_SERVER as $key => $value) {
      if (str_starts_with($key, "HTTP_")) {
          $headerName = strtolower(str_replace("_", "-", substr($key, 5)));
          $headers[$headerName] = $value;
      }
  }
  if (!array_key_exists("host", $headers)) {
      $headers["host"] = $_SERVER["HTTP_HOST"] ?? "";
  }

  if (verifyWebhookSignature($payload, $signature, $secret, $headers)) {
      // Handle your transfer event here
      http_response_code(200);
      echo "OK";
  } else {
      http_response_code(400);
      echo "Invalid signature";
  }
  ```

  ```java Java lines wrap theme={null}
  import static spark.Spark.port;
  import static spark.Spark.post;

  import java.util.HashMap;
  import java.util.Map;

  public class WebhookServer {
      public static void main(String[] args) {
          port(3000);

          post("/webhook", (request, response) -> {
              String payload = request.body();
              String signature = request.headers("X-Hook0-Signature");
              String secret = System.getenv().getOrDefault("WEBHOOK_SECRET", "");

              Map<String, String> headers = new HashMap<>();
              for (String headerName : request.headers()) {
                  headers.put(headerName.toLowerCase(), request.headers(headerName));
              }

              if (WebhookVerifier.verifyWebhookSignature(payload, signature, secret, headers, 5)) {
                  // Handle your transfer event here
                  response.status(200);
                  return "OK";
              }

              response.status(400);
              return "Invalid signature";
          });
      }
  }
  ```
</CodeGroup>
