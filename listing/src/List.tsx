import { useState } from 'react'
import { useConnect, useSigner, useAccount, useNetwork } from 'wagmi'
import { listToken, Execute } from '@reservoir0x/client-sdk'
import { WalletConnector } from './utils/walletConnector'
import { utils } from 'ethers'
import getTokens, { Token } from './getTokens'

async function list(
  listingPrice: string,
  maker: string | undefined,
  token: string,
  progressCallback: (message: string) => void,
  signer: ReturnType<typeof useSigner>['data']
) {
  // Required parameters to complete the transaction
  if (!signer) {
    throw new ReferenceError('Missing a signer')
  }

  if (!maker) {
    throw new ReferenceError('Missing a maker')
  }

  try {
    // Here we construct the parameters for the buy API
    // The taker refers to the wallet address making the transaction
    const query: Parameters<typeof listToken>['0']['query'] = {
      maker,
      weiPrice: utils.parseEther(listingPrice).toString(),
      token,
    }

    // Finally we supply these parameters to the buyToken
    // There are a couple of key parameters which we'll dive into
    await listToken({
      // The expectedPrice is used to protect against price mismatch issues when prices are rapidly changing
      // The expectedPrice can be omitted but the best practice is to supply this
      query,
      signer,
      apiBase: 'https://api-rinkeby.reservoir.tools',
      // The setState callback function is used to update the caller of the buyToken method
      // It passes in a set of steps that the SDK is following to process the transaction
      // It's useful for determining what step we're currently on and displaying a message to the user
      setState: (steps: Execute['steps']) => {
        if (!steps) {
          return
        }

        const currentStep = steps.find((step) => step.status === 'incomplete')
        if (currentStep) {
          progressCallback(currentStep.message || '')
        }
      },
      handleSuccess: () => {
        progressCallback('Success')
      },
      handleError: (error) => {
        progressCallback(`Error: ${error.message}`)
      },
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
  const [userTokens, setUserTokens] = useState<Token[]>([])

  const connector = connectors[0]

  const listingPrice = '0.01'

  return (
    <>
      <WalletConnector />

      <button
        onClick={async () => {
          if (account?.address) {
            const tokens = await getTokens(account?.address)
            setUserTokens(tokens)
            return
          }

          console.error('Wallet is not connected.')
        }}
      >
        Load your tokens
      </button>

      <table className="sweep-list">
        <thead>
          <tr>
            <th>Token Id</th>
            <th>List</th>
          </tr>
        </thead>
        <tbody>
          {userTokens.map(({ token }, i) => (
            <tr key={i}>
              <td>{token?.tokenId}</td>
              <td>
                <button
                  onClick={async () => {
                    if (activeChain?.id !== 4) {
                      alert(
                        'You are connected to the wrong network. Please, switch to the Rinkeby Test Network.'
                      )
                      return
                    }

                    if (!isConnected) {
                      await connector.connect()
                    }

                    setProgressText('')
                    const token_ = `${token?.contract}:${token?.tokenId}`

                    list(
                      listingPrice,
                      account?.address,
                      token_,
                      setProgressText,
                      signer
                    )
                  }}
                >
                  List
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {progressText.length > 0 && (
        <div className="progress-text">
          <b>Progress:</b> {progressText}
        </div>
      )}
    </>
  )
}
