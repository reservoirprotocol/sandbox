import { useEffect, useState } from "react";
import { arrayify, splitSignature } from "ethers/lib/utils";

import { pollUntilHasData, setParams } from "./utils";
import getCollectionFloor from "./getListings";
import {
  useConnect,
  useSigner,
  useDisconnect,
  useAccount,
  useNetwork,
} from "wagmi";

async function executeSteps(url, signer, newJson, progressCallback) {
  let json = newJson;

  if (!json) {
    const res = await fetch(url.href);
    json = await res.json();
    if (!res.ok) throw json;
  }

  //Handle any errors
  if (json.error || !json.steps) throw json;

  const incompleteIndex = json.steps.findIndex(
    ({ status }) => status === "incomplete"
  );

  // There are no more incomplete steps
  if (incompleteIndex === -1) return true;

  let { kind, data } = json.steps[incompleteIndex];

  // Append any extra params provided by API
  if (json.query) setParams(url, json.query);

  // If step is missing data, poll until it is ready
  if (!data) {
    json = await pollUntilHasData(url, incompleteIndex);
    if (!json.steps) throw json;
    data = json.steps[incompleteIndex].data;
  }

  // Handle each step based on it's kind
  switch (kind) {
    // Make an on-chain transaction
    case "transaction": {
      progressCallback("Waiting for user to confirm");

      const tx = await signer.sendTransaction(data);

      progressCallback("Finalizing on blockchain");

      await tx.wait();
      break;
    }

    // Sign a message
    case "signature": {
      let signature: string | undefined;

      progressCallback("Waiting for user to sign");

      // Request user signature
      if (data.signatureKind === "eip191") {
        signature = await signer.signMessage(arrayify(data.message));
      } else if (data.signatureKind === "eip712") {
        signature = await signer._signTypedData(
          data.domain,
          data.types,
          data.value
        );
      }

      if (signature) {
        // Split signature into r,s,v components
        const { r, s, v } = splitSignature(signature);
        // Include signature params in any future requests
        setParams(url, { r, s, v });
      }

      break;
    }

    // Post a signed order object to order book
    case "request": {
      const postOrderUrl = new URL(data.endpoint, url.origin);
      progressCallback("Verifying");

      try {
        async function getData() {
          const response = await fetch(postOrderUrl.href, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data.body),
          });

          return response;
        }

        const res = await getData();

        const resToJson = res.data;

        if (res.statusText !== "OK") throw resToJson;
      } catch (err) {
        progressCallback("Your order could not be posted.");
        throw err;
      }
      break;
    }

    // Confirm that an on-chain tx has been picked up by indexer
    case "confirmation": {
      progressCallback("Confirmed by indexer");
      break;
    }

    default:
      break;
  }
}

async function sweepTokens(
  collectionId,
  tokenIds,
  signer,
  taker,
  progressCallback
) {
  if (!signer) {
    throw new ReferenceError("Missing a signer");
  }

  if (!tokenIds || tokenIds.length === 0) {
    throw new ReferenceError("Missing token ids");
  }

  if (!collectionId) {
    throw new ReferenceError("Missing collection id");
  }

  try {
    // Construct an URL object for the `/execute/buy` endpoint
    const query = {
      taker: taker,
    };
    tokenIds?.forEach(
      (tokenId, index) =>
        // @ts-ignore
        (query[`tokens[${index}]`] = `${collectionId}:${tokenId}`)
    );
    const url = new URL(`https://api-rinkeby.reservoir.tools/execute/buy/v2`);
    setParams(url, query);
    await executeSteps(url, signer, undefined, progressCallback);

    return true;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default function Sweep() {
  const { data: signer } = useSigner();
  const { data: account } = useAccount();
  const { connect, connectors, pendingConnector, isConnecting, isConnected } =
    useConnect();
  const { disconnect } = useDisconnect();
  const { activeChain } = useNetwork();
  const [tokens, setTokens] = useState([]);
  const [selectedTokenIds, setSelectedTokenIds] = useState([]);
  const [collectionId, setCollectionId] = useState(
    "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b"
  );
  const [inputValue, setInputValue] = useState(
    "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b"
  );
  const [progressText, setProgressText] = useState("");

  const handleOnChange = (tokenId) => {
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
    console.log("Changed");
    getCollectionFloor(collectionId).then((tokens) => {
      setTokens(tokens);
    });
  }, [collectionId]);

  const connector = connectors[0];

  return (
    <>
      <div className="connector">
        {isConnected && (
          <button key={connector.id} onClick={() => disconnect(connector)}>
            Disconnect Wallet: {account.address}
          </button>
        )}
        {!isConnected && (
          <button
            disabled={!connector.ready}
            key={connector.id}
            onClick={() => connect(connector)}
          >
            Connect Browser Wallet
            {!connector.ready && " (unsupported)"}
            {isConnecting &&
              connector.id === pendingConnector?.id &&
              " (connecting)"}
          </button>
        )}
      </div>
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
            <th>Price</th>
            <th>Sweep</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, i) => (
            <tr key={i}>
              <td>{token.tokenId}</td>
              <td>{token.price}</td>
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
          if (activeChain.id !== 4) {
            alert(
              "You are connected to the wrong network. Please use the Rinkeby test network."
            );
            return;
          }

          if (!isConnected) {
            await connector.connect();
          }
          sweepTokens(
            collectionId,
            selectedTokenIds,
            signer,
            account.address,
            setProgressText
          );
        }}
      >
        Sweep Tokens
      </button>

      {progressText.length > "" && (
        <div class="progress-text">
          <b>Progress:</b> {progressText}
        </div>
      )}
    </>
  );
}
