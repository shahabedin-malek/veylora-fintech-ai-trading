> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Borrow

CDP Wallets enables your end users to borrow against their crypto through a native DeFi Borrow API. An end user's smart account opens a borrow position, by posting collateral and receiving a loan asset.

<CardGroup cols={3}>
  <Card title="Post collateral" icon="lock">
    Users deposit crypto as collateral to secure a borrow position
  </Card>

  <Card title="Borrow assets" icon="hand-holding-dollar">
    Receive a loan asset against posted collateral
  </Card>

  <Card title="Manage positions" icon="sliders">
    Adjust collateral and debt over time
  </Card>
</CardGroup>

<Warning>
  DeFi Borrow is available for **user wallets** and specifically **smart accounts** only. For EOAs, you can delegate your EOA to a smart account using [EIP-7702](/wallets/using-wallets/eip-7702).
</Warning>

<Info>
  Currently, **Base Mainnet** is the only supported network and **Morpho Blue** is the only supported protocol.
</Info>

# Overview

### Collateralized borrowing

Protocols like Morpho Blue offer a variety of collateralized borrow products. Each product contains a collateral asset and loan pair (i.e. cbBTC / USDC).

When an end user opens a borrow position, they deposit a fixed amount of collateral for a specific amount of a loan asset. For example, if an end user deposits 1 cbBTC and borrows 10,000 USDC, then they will lock 1 cbBTC as collateral and receive 10,000 USDC.

The loan amount increases over time, according to the net borrow rate. If the net borrow rate is 5% APY, then a borrow position of 10,000 USDC will become 10,500 USDC after one year, if no repayments are made.

The loan-to-value (LTV) is the collateral to debt ratio for the given borrow position. In this case, if 1 cbBTC is worth \$80,000, then the LTV is 10,000 / 80,000 = 0.125 (i.e. 12.5%).

$LTV = \frac{\text{Borrowed Amount}}{\text{Collateral Value (in Loan Token)}} = \frac{10{,}000}{80{,}000} = 0.125$

If the price of Bitcoin falls to \$11,000, the revised LTV is:

$LTV = \frac{10{,}000}{11{,}000} \approx 0.909 \; (90.9\%)$

The Liquidation Loan-to-Value (LLTV) is the maximum LTV threshold for a borrow position. If the LTV is greater than or equal to the LLTV, then the position is eligible for liquidation. This can result in the immediate loss of collateral assets supplied to the protocol.

$LTV = 90.9\% \geq LLTV = 86\% \implies \text{eligible for liquidation}$

To prevent liquidation, an end user can either repay debt to reduce their LTV, or they can add more collateral to bolster their position.

### Capabilities

<CardGroup cols={2}>
  <Card title="List borrow products" icon="list" href="#list-borrow-products">
    Browse available collateral/loan pairs and market parameters
  </Card>

  <Card title="Get a borrow product" icon="magnifying-glass" href="#get-a-borrow-product">
    Fetch details for a single product by its ID
  </Card>

  <Card title="Open a position" icon="plus-circle" href="#open-a-borrow-position">
    Post collateral and borrow a loan asset in a single atomic operation
  </Card>

  <Card title="Adjust a position" icon="sliders" href="#adjust-a-borrow-position">
    Add or withdraw collateral, repay debt or borrow more
  </Card>

  <Card title="Close a position" icon="xmark-circle" href="#close-a-borrow-position">
    Fully repay debt and withdraw all collateral in one atomic operation
  </Card>

  <Card title="List positions" icon="table-list" href="#list-borrow-positions">
    View collateral, debt, borrow APY, and health status
  </Card>
</CardGroup>

All borrow operations are executed through the end user's smart account as user operations, so they support [gas sponsorship](/wallets/using-wallets/smart-accounts#gas-sponsorship) and [policy enforcement](/wallets/security-and-policies/policy-engine/evm-policies).

### Origination fees

<Callout type="info">
  Origination fees are charged in the **loan token** (i.e. USDC).
</Callout>

Origination fees are configurable fees that are charged to an end user, every time they borrow a loan asset. When a user initially opens a borrow position, or when they borrow more of a loan asset, then they will be charged an origination fee.

In the CDP Portal, you can configure the origination fee you wish to charge, as well as the fee recipient wallet address. For example, an origination fee of 100 bps will incur a 0.10 USDC fee when a user borrows 100 USDC.

Additionally, CDP will charge a flat origination fee of 25 bps. In this case, if a user borrows 100 USDC, then they will be charged 0.025 USDC from CDP and 0.10 USDC from the fee recipient, for a total fee of 0.125 USDC.

<Steps>
  <Step title="Open CDP Portal">
    Navigate to your project's **Origination Fee** settings in [CDP Portal](https://portal.cdp.coinbase.com/wallets/non-custodial/defi).
  </Step>

  <Step title="Set the fee rate">
    Enter the fee rate in basis points (e.g., `100` for 1%).
  </Step>

  <Step title="Set the recipient address">
    Enter the EVM wallet address that will receive your developer fee.
  </Step>

  <Step title="Save">
    The fee is applied automatically on every borrow action through your project.
  </Step>
</Steps>

# Integration

### List borrow products

Before opening a position, list the available borrow products to find a collateral/loan pair. Each product includes its assets, protocol details (LLTV, oracle, IRM address), and a snapshot of the onchain market state at observation time.

`useListEvmBorrowProducts` automatically fetches when the user is signed in and both `network` and `protocol` are provided.

```tsx theme={null}
import { useListEvmBorrowProducts } from "@coinbase/cdp-hooks";

function BorrowProductList() {
  const { data, status, error } = useListEvmBorrowProducts({
    network: "base",
    protocol: "morpho_blue",
  });

  if (status === "pending") return <p>Loading...</p>;
  if (status === "error") return <p>Error: {error?.message}</p>;

  return (
    <ul>
      {data?.borrowProducts.map((p) => (
        <li key={p.borrowProductId}>
          {p.name} — {p.assets.map((a) => a.token.symbol).join(" / ")}
        </li>
      ))}
    </ul>
  );
}
```

### Get a borrow product

Fetch the full details of a specific borrow product by its ID, including venue, assets with capabilities, and Morpho Blue market parameters.

```tsx theme={null}
import { useGetEvmBorrowProduct } from "@coinbase/cdp-hooks";

function BorrowProductDetail({ productId }: { productId: string }) {
  const { data, status, error } = useGetEvmBorrowProduct({
    borrowProductId: productId,
  });

  if (status === "pending") return <p>Loading...</p>;
  if (status === "error") return <p>Error: {error?.message}</p>;
  if (!data) return null;

  const { marketParams } = data.protocolDetails;

  return (
    <div>
      <h3>{data.name}</h3>
      <p>LLTV: {(marketParams.lltvBps / 100).toFixed(2)}%</p>
      <p>Collateral: {marketParams.collateralToken.symbol}</p>
      <p>Loan: {marketParams.loanToken.symbol}</p>
    </div>
  );
}
```

### List borrow positions

View the borrow positions held by a smart account. Each position includes collateral balances, outstanding debt, borrow APY, and health status (healthy, undercollateralized, or no debt).

`useListBorrowPositions` automatically fetches when the user is signed in and a smart account address is provided.

```tsx theme={null}
import { useListBorrowPositions, useCurrentUser } from "@coinbase/cdp-hooks";

function BorrowPositions() {
  const { currentUser } = useCurrentUser();
  const smartAccount = currentUser?.evmSmartAccounts?.[0];

  const { data, status, error } = useListBorrowPositions({
    evmSmartAccount: smartAccount,
    enabled: !!smartAccount,
  });

  if (status === "pending") return <p>Loading...</p>;
  if (status === "error") return <p>Error: {error?.message}</p>;
  if (!data?.borrowPositions.length) return <p>No positions found.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Collateral</th>
          <th>Debt</th>
          <th>Health</th>
        </tr>
      </thead>
      <tbody>
        {data.borrowPositions.map((pos) => (
          <tr key={pos.borrowProductId}>
            <td>{pos.borrowProductId}</td>
            <td>
              {pos.onchainState.collateral.map((c) => (
                <div key={c.assetId}>
                  {c.token.symbol}: {c.amount}
                </div>
              ))}
            </td>
            <td>
              {pos.onchainState.debt.map((d) => (
                <div key={d.assetId}>
                  {d.token.symbol}: {d.amount}
                </div>
              ))}
            </td>
            <td>{pos.onchainState.healthStatus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Open a borrow position

Create a borrow position by posting collateral and borrowing a loan asset against a borrow product in a single user operation. The smart account must hold enough of the collateral token to cover the deposit.

<Callout type="warning">
  Amounts are specified in **human-readable decimal units** (for example, `"1"` for 1 cbBTC, `"100"` for 100 USDC), not atomic units. CDP converts them to atomic units internally using each token's decimals.
</Callout>

`useCreateBorrowPosition` submits the user operation and automatically monitors it onchain. `status` stays `"pending"` until the operation is confirmed.

```tsx theme={null}
import { useCreateBorrowPosition } from "@coinbase/cdp-hooks";

function OpenPosition() {
  const { createBorrowPosition, data, status, error } =
    useCreateBorrowPosition();

  const handleOpen = async () => {
    await createBorrowPosition({
      borrowProductId: "bp_07fb56c0-9afe-5440-8ff2-5b0e115458df",
      collateralAmount: "1",   // 1 cbBTC
      loanAmount: "10000",     // 10,000 USDC
      useCdpPaymaster: true,
    });
  };

  return (
    <div>
      <button
        onClick={handleOpen}
        disabled={status === "pending"}
      >
        {status === "pending" ? "Opening..." : "Open Position"}
      </button>
      {status === "success" && data?.userOpHash && (
        <p>Confirmed: {data.userOpHash}</p>
      )}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

<Note>
  Only one borrow position can exist per smart account per borrow product. If a position already exists, the request returns a `409`. Use the [adjust](#adjust-a-borrow-position) endpoint to modify it instead.
</Note>

### Adjust a borrow position

Adjust an existing position to add collateral, withdraw collateral, repay debt, or borrow more. You can perform one operation at a time, or combine certain pairs in a single request:

<CardGroup cols={2}>
  <Card title="Add collateral + Borrow more" icon="plus-circle">
    Supply collateral and borrow against it in one operation
  </Card>

  <Card title="Repay loan + Remove collateral" icon="minus-circle">
    Repay debt and withdraw collateral in one operation
  </Card>
</CardGroup>

All other combinations are rejected. At least one amount must be supplied.

```tsx theme={null}
import { useAdjustBorrowPosition } from "@coinbase/cdp-hooks";

function AdjustPosition() {
  const { adjustBorrowPosition, data, status, error } =
    useAdjustBorrowPosition();

  // Example: add collateral and borrow more in a single request
  const handleAdjust = async () => {
    await adjustBorrowPosition({
      borrowProductId: "bp_07fb56c0-9afe-5440-8ff2-5b0e115458df",
      addCollateralAmount: "0.5",  // add 0.5 cbBTC
      borrowLoanAmount: "5000",    // borrow 5,000 more USDC
      useCdpPaymaster: true,
    });
  };

  return (
    <div>
      <button
        onClick={handleAdjust}
        disabled={status === "pending"}
      >
        {status === "pending" ? "Adjusting..." : "Adjust Position"}
      </button>
      {status === "success" && data?.userOpHash && (
        <p>Confirmed: {data.userOpHash}</p>
      )}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### Close a borrow position

Close a position by fully repaying the outstanding debt and withdrawing all remaining collateral in a single user operation. There is no partial close. To adjust without closing, use the [adjust](#adjust-a-borrow-position) endpoint instead.

<Warning>
  The smart account must hold enough of the loan token to repay the full debt amount.
</Warning>

```tsx theme={null}
import { useCloseBorrowPosition } from "@coinbase/cdp-hooks";

function ClosePosition() {
  const { closeBorrowPosition, data, status, error } =
    useCloseBorrowPosition();

  const handleClose = async () => {
    await closeBorrowPosition({
      borrowProductId: "bp_07fb56c0-9afe-5440-8ff2-5b0e115458df",
      useCdpPaymaster: true,
    });
  };

  return (
    <div>
      <button
        onClick={handleClose}
        disabled={status === "pending"}
      >
        {status === "pending" ? "Closing..." : "Close Position"}
      </button>
      {status === "success" && data?.userOpHash && (
        <p>Confirmed: {data.userOpHash}</p>
      )}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```
