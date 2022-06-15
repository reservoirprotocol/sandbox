import "./App.css";

import { createClient, configureChains, WagmiConfig, chain } from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import Sweep from "./sweep";

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

function App() {
  return (
    <WagmiConfig client={client}>
      <div className="App">
        <header className="App-header">Sweep Demo</header>
        <Sweep />
      </div>
    </WagmiConfig>
  );
}

export default App;
