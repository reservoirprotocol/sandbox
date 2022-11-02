import { useState } from "react";
import { useConnect, useSigner, useAccount, useNetwork } from "wagmi";
import {
  Execute,
  getClient,
  ReservoirClientActions,
} from "@reservoir0x/reservoir-kit-client";
import { WalletConnector } from "./utils/walletConnector";
import getTokens, { Token } from "./getTokens";

async function buy(
  tokens: Parameters<ReservoirClientActions["buyToken"]>["0"]["tokens"],
  progressCallback: (message: string) => void,
  signer: ReturnType<typeof useSigner>["data"]
) {
  // Required parameters to complete the transaction
  if (!signer) {
    throw new ReferenceError("Missing a signer");
  }

  try {
    // Then we supply these parameters to the buyToken
    await getClient()
      .actions.buyToken({
        signer,
        tokens,
        onProgress: (steps: Execute["steps"]) => {
          if (!steps) {
            return;
          }

          const currentStep = steps.find((step) =>
            step.items?.find((item) => item.status === "incomplete")
          );
          if (currentStep) {
            const progress = currentStep.items?.findIndex(
              (item) => item.status === "incomplete"
            );
            progressCallback(
              currentStep.action
                ? `${currentStep.action} (${(progress || 0) + 1}/${
                    currentStep.items?.length
                  })`
                : ""
            );
          }
        },
      })
      .then(() => {
        progressCallback("Success");
      })
      .catch((error: Error) => {
        progressCallback(`Error: ${error.message}`);
      });

    return true;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default function List() {
  const { data: signer } = useSigner();
  const { data: account } = useAccount();
  const { connectors, isConnected } = useConnect();
  const { activeChain } = useNetwork();
  const [progressText, setProgressText] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [contract, setContract] = useState(
    "0x4d68e14cd7dec510c84326f54ee41f88e8fad59b"
  );
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);

  const connector = connectors[0];

  const handleOnChange = (tokenId: string) => {
    const selected = selectedTokenIds.includes(tokenId);
    let updatedSelectedTokenIds = selectedTokenIds.slice();

    if (selected) {
      updatedSelectedTokenIds = selectedTokenIds.filter(
        (selectedTokenId) => tokenId !== selectedTokenId
      );
    } else {
      updatedSelectedTokenIds.push(tokenId);
    }

    setSelectedTokenIds(updatedSelectedTokenIds);
  };

  return (
    <>
      <WalletConnector />

      {isConnected && (
        <>
          <label style={{ marginRight: 10 }} htmlFor="listing-price">
            Collection Contract Address
          </label>
          <input
            id="listing-price"
            className="collection-input"
            type="text"
            value={contract}
            placeholder="Contract address"
            onChange={(e) => setContract(e.target.value)}
          />
          <div style={{ marginBottom: 10 }} />
          <button
            onClick={async () => {
              setErrorText("");
              setLoading(true);
              const tokens = await getTokens(contract);
              setLoading(false);
              const filteredTokens = tokens.filter((token) =>
                Boolean(token.market?.floorAsk?.price?.amount?.native)
              );
              if (filteredTokens.length === 0) {
                setErrorText(`There are no tokens available to purchase.`);
              }
              setTokens(filteredTokens);
            }}
          >
            Load tokens to buy
          </button>

          {tokens.length > 0 && (
            <>
              <table className="sweep-list">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Price (ETH)</th>
                    <th>Select</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token, i) => (
                    <tr key={i}>
                      <td>{`${token.token?.contract}:${token.token?.tokenId}`}</td>
                      <td>{token.market?.floorAsk?.price?.amount?.native}</td>
                      <td>
                        <input
                          type="checkbox"
                          value={token.token?.tokenId}
                          checked={
                            token.token?.tokenId
                              ? selectedTokenIds.includes(token.token.tokenId)
                              : false
                          }
                          onChange={() => {
                            if (token.token?.tokenId) {
                              handleOnChange(token.token.tokenId);
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                disabled={!isConnected || loading}
                onClick={async () => {
                  setLoading(true);
                  if (activeChain?.id !== 5) {
                    alert(
                      "You are connected to the wrong network. Please, switch to the Goerli Test Network."
                    );

                    setLoading(false);
                    return;
                  }

                  if (!account?.address) {
                    setLoading(false);
                    return;
                  }

                  if (!isConnected) {
                    await connector.connect();
                  }

                  setProgressText("");
                  const tokens: Parameters<
                    ReservoirClientActions["buyToken"]
                  >["0"]["tokens"] = [];

                  selectedTokenIds?.forEach((tokenId) =>
                    tokens.push({ contract, tokenId })
                  );

                  await buy(tokens, setProgressText, signer);

                  setLoading(false);
                }}
              >
                Buy Tokens
              </button>
            </>
          )}
        </>
      )}

      {loading && (
        <div className="progress-text">
          <p>Loading...</p>
        </div>
      )}
      {progressText !== "" && (
        <div className="progress-text">
          <p>Progress:</p> {progressText}
        </div>
      )}
      {errorText !== "" && (
        <div className="progress-text">
          <p>{errorText}</p>
        </div>
      )}
    </>
  );
}
