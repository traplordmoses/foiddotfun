# wFOID Control Panel

A full-featured dApp for managing your **Wrapped Foid (wFOID)** token and associated bridge on the Fluent testnet.

Built with **Next.js (App Router)**, **Typescript**, **wagmi** v2, **viem**, **RainbowKit**, **TailwindCSS** and **shadcn/ui** components.

## Features

- 🧠 **Dashboard**: view your wFOID balance, total supply, pause status and your roles (MINTER/PAUSER). Recent on‑chain events (transfer, role changes, pause/unpause, bridge events) are decoded and displayed in a scrolling list.
- 💸 **Token page**: transfer tokens, approve allowances and view allowance, mint and burn if your address has the `MINTER_ROLE`, and pause/unpause the token if you have the `PAUSER_ROLE`. Read‑only metadata (name, symbol, decimals, total supply) is always visible.
- 🌉 **Bridge page**: burn wFOID to redeem on Monero by providing a Monero destination; mint on Fluent with a signed attestation. A local helper computes the exact message hash that needs to be signed offline. Displays router chain ID and whether the connected wallet is an attestor.
- 📜 **Registry page**: view the current registry owner and check if any address is an attestor. If the connected wallet is the owner, it can add or remove attestors.
- 🔐 **Role‑aware UI**: buttons for mint/burn/pause/unpause and registry management only appear if your account has the appropriate role on chain. No secrets are ever requested; signing is handled by your wallet.
- 🔄 **FoidSwap router**: connect the newly deployed pair, execute swaps, and manage liquidity directly against the Router contract with automatic allowance handling and Fluent Testnet onboarding.
- 🎨 **Fluent meets Bebop**: dark first UI with a neon purple→pink→blue gradient inspired by Fluent’s brand, subtle noise overlays and rounded card components. The layout gently animates on hover.

## Getting Started

1. **Install dependencies** (requires Node 18+ and npm):

```bash
npm install
```

2. **Configure environment variables**:

Copy `.env.local.example` to `.env.local` and adjust the addresses or RPC URLs if necessary.

```env
NEXT_PUBLIC_RPC=https://rpc.testnet.fluent.xyz
NEXT_PUBLIC_CHAIN_ID=20994
NEXT_PUBLIC_FACTORY=0xe97639fd6Ff7231ed270Ea16BD9Ba2c79f4cD2cc
NEXT_PUBLIC_ROUTER=0xd71330e54eAA2e4248E75067F8f23bB2a6568613
NEXT_PUBLIC_TOKEN_A=0x403ECF8ba28E58CE4d1847C1C95ac54651fAB151
NEXT_PUBLIC_TOKEN_B=0xC08c0a41725F2329A9a315C643FE9b1a012D6213
NEXT_PUBLIC_BLOCK_EXPLORER=https://testnet.fluentscan.xyz

# legacy variables for existing dashboards (optional)
NEXT_PUBLIC_RPC_URL=https://rpc.testnet.fluent.xyz
NEXT_PUBLIC_WFOID=0x403ECF8ba28E58CE4d1847C1C95ac54651fAB151
NEXT_PUBLIC_REGISTRY=0xd0AD34C087b59292Fb9eBbA17ED2C0B941C7010D
```

3. **Run locally**:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser. Connect your wallet via the RainbowKit connect button. The dApp will automatically prompt you to add/switch to the Fluent testnet (chain ID 20994) if you are on a different network.

4. **Build for production**:

```bash
npm run build
npm start
```

## Screenshots

> **Note:** the screenshots below are illustrative of the final look and feel. They demonstrate the dark‑first UI, gradient cards and the structure of each page.

### Dashboard

![Dashboard](screenshots/dashboard.png)

### Token page

![Token](screenshots/token.png)

### Bridge page

![Bridge](screenshots/bridge.png)

### Registry page

![Registry](screenshots/registry.png)

## Folder structure

- `src/app` – application pages using Next.js App Router
  - `layout.tsx` – global layout with providers and dark theme
  - `page.tsx` – dashboard page
  - `token/page.tsx` – token management page
  - `bridge/page.tsx` – bridge interactions page
  - `registry/page.tsx` – attestor registry page
  - `foidswap/page.tsx` – router swaps and liquidity management
- `src/components` – reusable UI components (ConnectBar, NetworkGate, StatCard, RoleBadge, TxButton, AmountInput, EventList)
- `src/lib/contracts.ts` – addresses and typed ABIs
- `src/abis` – contract ABI definitions used by wagmi/viem
- `public/noise.png` – subtle noise texture for the background
- `.env.local.example` – example environment variables

## Notes

- This project uses [wagmi](https://wagmi.sh/) v2 with [viem](https://viem.sh/) under the hood for contract interaction and signing.
- Wallet connectivity is provided by [RainbowKit](https://www.rainbowkit.com/), configured with the Fluent testnet RPC.
- The UI is styled with [TailwindCSS](https://tailwindcss.com/) and custom utility classes following the brief’s aesthetic guidelines.
- ABIs are reconstructed from the provided function and event signatures. If you update your contracts, drop the new ABIs into `src/abis` and update the addresses in `.env.local`.

## License

This project is provided as‑is for demonstration purposes and does not include a specific license. Use at your own risk.
