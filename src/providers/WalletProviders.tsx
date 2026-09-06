import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "@/lib/wagmi/config";
import type { ReactNode } from "react";

/**
 * Wallet provider layer — wagmi + RainbowKit context for the route subtree.
 *
 * Loaded via lazy() from App.tsx so vendor-blockchain (viem/wagmi/ox, ~420 KB
 * gzip) and rainbowkit stay off the entry chunk's synchronous import graph.
 * Every consumer of wallet state (useWallet, ConnectButton, useWatchModeConnect)
 * renders inside the lazy route components below this boundary.
 */
export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        theme={{ lightMode: lightTheme(), darkMode: darkTheme() }}
        modalSize="compact"
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
