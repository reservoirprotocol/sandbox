import "./App.css";

import { createClient, configureChains, WagmiConfig, chain } from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import Sweep from "./sweep";
import { ReservoirSDK } from "@reservoir0x/client-sdk";

const { chains } = configureChains([chain.rinkeby], [publicProvider()]);

const client = createClient({
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

ReservoirSDK.init({
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
