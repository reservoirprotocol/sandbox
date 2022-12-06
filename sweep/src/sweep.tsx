import { useEffect, useState } from "react";

import getCollectionFloor, { Token } from "./getListings";
import { useConnect, useSigner, useNetwork } from "wagmi";
import { WalletConnector } from "./utils/walletConnector";
import {
  Execute,
  getClient,
  ReservoirClientActions,
} from "@reservoir0x/reservoir-kit-client";
import { constants } from "ethers";

async function sweepTokens(
  sweepTotal: number | undefined,
  tokens: Parameters<ReservoirClientActions["buyToken"]>["0"]["tokens"],
  progressCallback: (message: string) => void,
  signer?: ReturnType<typeof useSigner>["data"],
  sweepCurrency?: string
) {
  // Required parameters to complete the transaction
  if (!signer) {
    throw new ReferenceError("Missing a signer");
  }

  try {
    // Then we supply these parameters to the buyToken
    // There are a couple of key parameters which we'll dive into

    // Pass any additional parameters to the underlying execute buy api, using the client actions type to extract the right types
    const options: Parameters<
      ReservoirClientActions["buyToken"]
    >[0]["options"] = {};

    if (sweepCurrency) {
      options.currency = sweepCurrency;
    }

    getClient()
      ?.actions.buyToken({
        tokens: tokens,
        signer: signer,
        // The expectedPrice is used to protect against price mismatch issues when prices are rapidly changing
        // The expectedPrice can be omitted but the best practice is to supply this
        expectedPrice: sweepTotal,
        // Pass any additional parameters to the underlying execute buy api
        options,
        // The onProgress callback function is used to update the caller of the buyToken method
        // It passes in a set of steps that the SDK is following to process the transaction
        // It's useful for determining what step we're currently on and displaying a message to the user
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

export default function Sweep() {
  const { data: signer } = useSigner();
  const { connectors, isConnected } = useConnect();
  const { activeChain } = useNetwork();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<Token[]>([]);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [sweepTotal, setSweepTotal] = useState(0);
  const [sweepCurrencyContract, setSweepCurrencyContract] = useState<
    string | undefined
  >();
  const [collectionId, setCollectionId] = useState(
    "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b"
  );
  const [inputValue, setInputValue] = useState(
    "0xf5de760f2e916647fd766b4ad9e85ff943ce3a2b"
  );
  const [progressText, setProgressText] = useState("");

  const handleOnChange = (token: Token) => {
    const selectedTokenIds = selectedTokens.map(
      (token) => token.token?.tokenId
    );
    const selected = selectedTokenIds.includes(token.token?.tokenId);
    let updatedselectedTokens = selectedTokens.slice();

    if (selected) {
      updatedselectedTokens = selectedTokens.filter(
        (selectedToken) => selectedToken.token?.tokenId !== token.token?.tokenId
      );
    } else {
      updatedselectedTokens.push(token);
    }

    setSelectedTokens(updatedselectedTokens);
    const ids: string[] = [];
    updatedselectedTokens.forEach((token) => {
      if (token.token?.tokenId) {
        ids.push(token.token.tokenId);
      }
    });
    setSelectedTokenIds(ids);
  };

  useEffect(() => {
    getCollectionFloor(collectionId).then((tokens) => {
      setTokens(tokens);
    });
  }, [collectionId]);

  useEffect(() => {
    const newTotal = tokens.reduce((total, token) => {
      if (
        token.token &&
        selectedTokenIds.includes(token.token?.tokenId) &&
        token.market?.floorAsk?.price?.amount?.decimal
      ) {
        total += token.market.floorAsk.price.amount.decimal;
      }
      return total;
    }, 0);

    setSweepTotal(newTotal);
  }, [tokens, selectedTokenIds]);

  const connector = connectors[0];
  const selectedTokensCurrencies = selectedTokens.map(
    (token) => token.market?.floorAsk?.price?.currency
  );

  if (
    !selectedTokensCurrencies.find(
      (currency) => currency?.contract === constants.AddressZero
    )
  ) {
    selectedTokensCurrencies.push({
      contract: constants.AddressZero,
      symbol: "ETH",
      decimals: 18,
      name: "Ether",
    });
  }

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
          setSelectedTokens([]);
          setSelectedTokenIds([]);
          setSweepCurrencyContract(undefined);
        }}
      >
        Get Listings
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
              <td>{token.token?.tokenId}</td>
              <td>
                {token.market?.floorAsk?.price?.amount?.decimal}{" "}
                {token.market?.floorAsk?.price?.currency?.symbol}
              </td>
              <td>
                <input
                  type="checkbox"
                  value={token.token?.tokenId}
                  checked={
                    token.token?.tokenId
                      ? selectedTokenIds.includes(token.token.tokenId)
                      : false
                  }
                  onChange={() => handleOnChange(token)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!tokens.length && (
        <div className="empty-message">
          Enter a collection address to get available tokens
        </div>
      )}

      <select
        style={{ marginRight: 20 }}
        value={sweepCurrencyContract}
        onChange={(e) => {
          setSweepCurrencyContract(e.target.value);
        }}
      >
        <option disabled selected>
          Currency
        </option>
        {selectedTokensCurrencies.map((currency) => (
          <option value={currency?.contract}>{currency?.symbol}</option>
        ))}
      </select>

      <button
        disabled={selectedTokens.length === 0}
        onClick={async () => {
          if (activeChain?.id !== 5) {
            alert(
              "You are connected to the wrong network. Please use the Goerli test network."
            );
            return;
          }

          if (!isConnected) {
            await connector.connect();
          }
          setProgressText("");
          let expectedPrice: number | undefined = sweepTotal;
          const firstTokenCurrency =
            selectedTokens[0].market?.floorAsk?.price?.currency?.contract;
          let mixedCurrencies = false;

          const tokens = selectedTokens.map((token) => {
            if (!mixedCurrencies) {
              mixedCurrencies =
                token.market?.floorAsk?.price?.currency?.contract !==
                firstTokenCurrency;
            }
            return {
              tokenId: token.token?.tokenId as string,
              contract: token.token?.contract as string,
            };
          });
          if (mixedCurrencies) {
            expectedPrice = undefined;
          }
          sweepTokens(
            expectedPrice,
            tokens,
            setProgressText,
            signer,
            sweepCurrencyContract
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
