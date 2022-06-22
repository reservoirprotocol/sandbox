import './App.css'
import { createClient, configureChains, WagmiConfig, chain } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'
import { InjectedConnector } from 'wagmi/connectors/injected'
import List from './List'

const { chains } = configureChains([chain.rinkeby], [publicProvider()])

const client = createClient({
  autoConnect: true,
  connectors: [
    new InjectedConnector({
      chains,
      options: {
        name: 'Injected',
        shimDisconnect: true,
      },
    }),
  ],
})

export default function App() {
  return (
    <WagmiConfig client={client}>
      <div className="App">
        <header className="App-header">Listing Demo</header>
        <List />
      </div>
    </WagmiConfig>
  )
}
