import { useEffect, useState } from "react";

import getCollectionFloor, { Token } from "./getListings";
import { useConnect, useSigner, useAccount, useNetwork } from "wagmi";
import { buyToken, Execute } from "@reservoir0x/client-sdk";
import { WalletConnector } from "./utils/walletConnector";

async function sweepTokens(
  sweepTotal: number,
  collectionId: string,
  tokenIds: string[],
  progressCallback: (message: string) => void,
  signer?: ReturnType<typeof useSigner>["data"],
  taker?: string
) {
  // Required parameters to complete the transaction
  if (!signer) {
    throw new ReferenceError("Missing a signer");
  }

  if (!tokenIds || tokenIds.length === 0) {
    throw new ReferenceError("Missing token ids");
  }

  if (!collectionId) {
    throw new ReferenceError("Missing collection id");
  }

  if (!taker) {
    throw new ReferenceError("Missing a taker");
  }

  try {
    // Here we construct the parameters for the buy API
    // The taker refers to the wallet address making the transaction
    const query: Parameters<typeof buyToken>["0"]["query"] = {
      taker: taker,
    };

    // Next we need to walk through all the tokens and create a hash table where the key is tokens[index]
    // The value is the collection contract address and the token id seperated by a colon
    tokenIds?.forEach((tokenId, index) => {
      const key = `tokens[${index}]`;
      const value = `${collectionId}:${tokenId}`;
      // Due to how the openapi spec is generated we need to ignore dynamic parameters like this token array
      //@ts-ignore
      query[key] = value;
    });

    // Finally we supply these parameters to the buyToken
    // There are a couple of key parameters which we'll dive into
    await buyToken({
      // The expectedPrice is used to protect against price mismatch issues when prices are rapidly changing
      // The expectedPrice can be omitted but the best practice is to supply this
      expectedPrice: sweepTotal,
      query: query,
      signer: signer,
      apiBase: "https://api-rinkeby.reservoir.tools",
      // The setState callback function is used to update the caller of the buyToken method
      // It passes in a set of steps that the SDK is following to process the transaction
      // It's useful for determining what step we're currently on and displaying a message to the user
      setState: (steps: Execute["steps"]) => {
        if (!steps) {
          return;
        }

        const currentStep = steps.find((step) => step.status === "incomplete");
        if (currentStep) {
          progressCallback(currentStep.message || "");
        }
      },
      handleSuccess: () => {
        progressCallback("Success");
      },
      handleError: (error) => {
        progressCallback(`Error: ${error.message}`);
      },
    });

    return true;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default function Sweep() {
  const { data: signer } = useSigner();
  const { data: account } = useAccount();
  const { connectors, isConnected } = useConnect();
  const { activeChain } = useNetwork();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [sweepTotal, setSweepTotal] = useState(0);
  const [collectionId, setCollectionId] = useState(
    "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b"
  );
  const [inputValue, setInputValue] = useState(
    "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b"
  );
  const [progressText, setProgressText] = useState("");

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
                  onChange={() => handleOnChange(token.tokenId)}
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
        disabled={selectedTokenIds.length === 0}
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
          sweepTokens(
            sweepTotal,
            collectionId,
            selectedTokenIds,
            setProgressText,
            signer,
            account?.address
          );
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
