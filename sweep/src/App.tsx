import "./App.css";

import {
  createClient as createWagmiClient,
  configureChains,
  WagmiConfig,
  chain,
} from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import Sweep from "./sweep";
import { createClient } from "@reservoir0x/reservoir-kit-client";

const { chains } = configureChains([chain.rinkeby], [publicProvider()]);

const client = createWagmiClient({
  autoConnect: true,
  connectors: [
    new InjectedConnector({
      chains,
      options: {
        name: "Injected",
        shimDisconnect: true,
      },
    }),
  ],
});

createClient({
  apiBase: "https://api-rinkeby.reservoir.tools",
});

export default function App() {
  return (
    <WagmiConfig client={client}>
      <div className="App">
        <header className="App-header">Sweep Demo</header>
        <Sweep />
      </div>
    </WagmiConfig>
  );
}
