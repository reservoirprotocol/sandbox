import { useEffect, useState } from "react";

import getCollectionFloor, { Token } from "./getListings";
import { useConnect, useSigner, useNetwork } from "wagmi";
import { WalletConnector } from "./utils/walletConnector";
import {
  Execute,
  getClient,
  ReservoirClientActions,
} from "@reservoir0x/reservoir-kit-client";

async function sweepTokens(
  sweepTotal: number,
  tokens: Parameters<ReservoirClientActions["buyToken"]>["0"]["tokens"],
  progressCallback: (message: string) => void,
  signer?: ReturnType<typeof useSigner>["data"]
) {
  // Required parameters to complete the transaction
  if (!signer) {
    throw new ReferenceError("Missing a signer");
  }

  try {
    // Then we supply these parameters to the buyToken
    // There are a couple of key parameters which we'll dive into
    getClient()
      ?.actions.buyToken({
        tokens: tokens,
        signer: signer,
        // The expectedPrice is used to protect against price mismatch issues when prices are rapidly changing
        // The expectedPrice can be omitted but the best practice is to supply this
        expectedPrice: sweepTotal,
        // The onProgress callback function is used to update the caller of the buyToken method
        // It passes in a set of steps that the SDK is following to process the transaction
        // It's useful for determining what step we're currently on and displaying a message to the user
        onProgress: (steps: Execute["steps"]) => {
          if (!steps) {
            return;
          }

          const currentStep = steps.find(
            (step) => step.status === "incomplete"
          );
          if (currentStep) {
            progressCallback(currentStep.message || "");
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

export default function Sweep() {
  const { data: signer } = useSigner();
  const { connectors, isConnected } = useConnect();
  const { activeChain } = useNetwork();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokens, setselectedTokens] = useState<Token[]>([]);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [sweepTotal, setSweepTotal] = useState(0);
  const [collectionId, setCollectionId] = useState(
    "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b"
  );
  const [inputValue, setInputValue] = useState(
    "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b"
  );
  const [progressText, setProgressText] = useState("");

  const handleOnChange = (token: Token) => {
    const selectedTokenIds = selectedTokens.map((token) => token.tokenId);
    const selected = selectedTokenIds.includes(token.tokenId);
    let updatedselectedTokens = selectedTokens.slice();

    if (selected) {
      updatedselectedTokens = selectedTokens.filter(
        (selectedToken) => selectedToken.tokenId !== token.tokenId
      );
    } else {
      updatedselectedTokens.push(token);
    }

    setselectedTokens(updatedselectedTokens);
    setSelectedTokenIds(updatedselectedTokens.map((token) => token.tokenId));
  };

  useEffect(() => {
    getCollectionFloor(collectionId).then((tokens) => {
      setTokens(tokens);
    });
  }, [collectionId]);

  useEffect(() => {
    const newTotal = tokens.reduce((total, token) => {
      if (selectedTokenIds.includes(token.tokenId) && token.floorAskPrice) {
        total += token.floorAskPrice;
      }
      return total;
    }, 0);

    setSweepTotal(newTotal);
  }, [tokens, selectedTokenIds]);

  const connector = connectors[0];

  return (
    <>
      <WalletConnector />
      <input
        className="collection-input"
        type="text"
        value={inputValue}
        placeholder="Collection Address"
        onChange={(e) => setInputValue(e.target.value)}
      />
      <button
        onClick={() => {
          setCollectionId(inputValue);
        }}
      >
        Get Floor
      </button>

      <table className="sweep-list">
        <thead>
          <tr>
            <th>Token Id</th>
            <th>Floor Price</th>
            <th>Sweep</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, i) => (
            <tr key={i}>
              <td>{token.tokenId}</td>
              <td>{token.floorAskPrice}</td>
              <td>
                <input
                  type="checkbox"
                  value={token.tokenId}
                  checked={selectedTokenIds.includes(token.tokenId)}
                  onChange={() => handleOnChange(token)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!tokens.length && (
        <div className="empty-message">
          Enter a collection address to get available floor tokens
        </div>
      )}

      <button
        disabled={selectedTokens.length === 0}
        onClick={async () => {
          if (activeChain?.id !== 4) {
            alert(
              "You are connected to the wrong network. Please use the Rinkeby test network."
            );
            return;
          }

          if (!isConnected) {
            await connector.connect();
          }
          setProgressText("");
          sweepTokens(sweepTotal, selectedTokens, setProgressText, signer);
        }}
      >
        Sweep Tokens
      </button>

      {progressText.length > 0 && (
        <div className="progress-text">
          <b>Progress:</b> {progressText}
        </div>
      )}
    </>
  );
}
