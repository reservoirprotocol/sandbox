import { useState } from 'react'
import { useConnect, useSigner, useAccount, useNetwork } from 'wagmi'
import { WalletConnector } from './utils/walletConnector'
import { utils } from 'ethers'
import getTokens, { Token } from './getTokens'
import { DateTime } from 'luxon'
import ExpirationSelector from './ExpirationSelector'
import OrderKindSelector from './OrderKindSelector'
import OrderbookSelector from './OrderbookSelector'
import {
  Execute,
  ReservoirClientActions,
  getClient,
} from '@reservoir0x/reservoir-kit-client'

export type OrderKind = 'looks-rare' | 'x2y2' | 'zeroex-v4' | 'seaport'

export type Orderbook = 'opensea' | 'looks-rare' | 'reservoir'

async function list(
  listing: Parameters<
    ReservoirClientActions['listToken']
  >['0']['listings']['0'],
  progressCallback: (message: string) => void,
  signer: ReturnType<typeof useSigner>['data']
) {
  // Required parameters to complete the transaction
  if (!signer) {
    throw new ReferenceError('Missing a signer')
  }

  try {
    await getClient()
      ?.actions.listToken({
        listings: [listing],
        signer,
        onProgress: (steps: Execute['steps']) => {
          if (!steps) {
            return
          }

          const currentStep = steps.find((step) =>
            step.items?.find((item) => item.status === 'incomplete')
          )
          if (currentStep) {
            const progress = currentStep.items?.findIndex(
              (item) => item.status === 'incomplete'
            )
            progressCallback(
              currentStep.action
                ? `${currentStep.action} (${progress}/${currentStep.items?.length})`
                : ''
            )
          }
        },
      })
      .then(() => {
        progressCallback('Success')
      })
      .catch((error: Error) => {
        progressCallback(`Error: ${error.message}`)
      })

    return true
  } catch (err) {
    console.error(err)
    throw err
  }
}

export default function List() {
  const { data: signer } = useSigner()
  const { data: account } = useAccount()
  const { connectors, isConnected } = useConnect()
  const { activeChain } = useNetwork()
  const [progressText, setProgressText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [userTokens, setUserTokens] = useState<Token[]>([])

  // INPUTS
  const [expiration, setExpiration] = useState('oneWeek')
  const [orderKind, setOrderKind] = useState<OrderKind>('seaport')
  const [orderbook, setOrderbook] = useState<Orderbook>('reservoir')
  const [listingPrice, setListingPrice] = useState('0.01')
  const [fee_, setFee_] = useState('')
  const [feeRecipient, setFeeRecipient] = useState<string>('')

  const connector = connectors[0]

  return (
    <>
      <WalletConnector />

      {isConnected && (
        <>
          <button
            onClick={async () => {
              setErrorText('')
              if (account?.address) {
                setLoading(true)
                const tokens = await getTokens(account?.address)
                setLoading(false)
                if (tokens.length === 0) {
                  setErrorText(
                    `You don't have any tokens available for listing.`
                  )
                }
                setUserTokens(tokens)
                return
              }

              console.error('Wallet is not connected.')
            }}
          >
            Load one of your tokens
          </button>

          {userTokens.length > 0 && (
            <table className="sweep-list">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>List</th>
                </tr>
              </thead>
              <tbody>
                {userTokens.map(({ token: token_ }, i) => (
                  <tr key={i}>
                    <td>{`${token_?.contract}:${token_?.tokenId}`}</td>
                    <td>
                      <ExpirationSelector
                        presets={expirationPresets}
                        setExpiration={setExpiration}
                        expiration={expiration}
                      />
                      <div style={{ marginBottom: 10 }} />
                      <OrderKindSelector setOrderKind={setOrderKind} />

                      <div style={{ marginBottom: 10 }} />
                      <label
                        style={{ marginRight: 10 }}
                        htmlFor="listing-price"
                      >
                        Listing Price
                      </label>
                      <input
                        id="listing-price"
                        className="collection-input"
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={listingPrice}
                        placeholder="Listing Price"
                        onChange={(e) => setListingPrice(e.target.value)}
                      />
                      <span>ETH</span>

                      <div style={{ marginBottom: 10 }} />
                      <label style={{ marginRight: 10 }} htmlFor="fee">
                        Fee
                      </label>
                      <input
                        id="fee"
                        className="collection-input"
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={fee_}
                        placeholder="Fee"
                        onChange={(e) => setFee_(e.target.value)}
                      />
                      <span>%</span>

                      <div style={{ marginBottom: 10 }} />
                      <label
                        style={{ marginRight: 10 }}
                        htmlFor="fee-recipient"
                      >
                        Fee Recipient
                      </label>
                      <input
                        id="fee-recipient"
                        className="collection-input"
                        type="text"
                        value={feeRecipient}
                        placeholder="Fee Recipient"
                        onChange={(e) => setFeeRecipient(e.target.value)}
                      />

                      <div style={{ marginBottom: 10 }} />
                      <OrderbookSelector setOrderbook={setOrderbook} />

                      <div style={{ marginBottom: 10 }} />
                      <button
                        disabled={!isConnected || loading}
                        onClick={async () => {
                          setLoading(true)
                          if (activeChain?.id !== 5) {
                            alert(
                              'You are connected to the wrong network. Please, switch to the Goerli Test Network.'
                            )

                            setLoading(false)
                            return
                          }

                          if (!account?.address) {
                            setLoading(false)
                            return
                          }

                          if (!isConnected) {
                            await connector.connect()
                          }

                          setProgressText('')

                          const weiPrice = utils
                            .parseEther(listingPrice)
                            .toString()
                          const token = `${token_?.contract}:${token_?.tokenId}`
                          const expirationTime = expirationPresets
                            .find(({ preset }) => preset === expiration)
                            ?.value()
                          const fee = `${+fee_ * 100}`

                          const listing: Parameters<
                            ReservoirClientActions['listToken']
                          >['0']['listings']['0'] = {
                            token,
                            weiPrice,
                            orderKind: orderKind,
                            orderbook: orderbook,
                            expirationTime: expirationTime,
                          }

                          if (fee_ !== '' && feeRecipient) {
                            listing.fees = [`${feeRecipient}:${fee}`]
                          }

                          await list(listing, setProgressText, signer)

                          setLoading(false)
                        }}
                      >
                        List Token
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {loading && (
        <div className="progress-text">
          <p>Loading...</p>
        </div>
      )}
      {progressText !== '' && (
        <div className="progress-text">
          <p>Progress:</p> {progressText}
        </div>
      )}
      {errorText !== '' && (
        <div className="progress-text">
          <p>{errorText}</p>
        </div>
      )}
    </>
  )
}

const expirationPresets = [
  {
    preset: 'oneHour',
    value: () =>
      DateTime.now().plus({ hours: 1 }).toMillis().toString().slice(0, -3),
    display: '1 Hour',
  },
  {
    preset: 'oneWeek',
    value: () =>
      DateTime.now().plus({ weeks: 1 }).toMillis().toString().slice(0, -3),
    display: '1 Week',
  },
  {
    preset: 'oneMonth',
    value: () =>
      DateTime.now().plus({ months: 1 }).toMillis().toString().slice(0, -3),
    display: '1 Month',
  },
  {
    preset: 'none',
    value: () => '0',
    display: 'None',
  },
]
