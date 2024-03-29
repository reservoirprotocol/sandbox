//https://api.reservoir.tools/tokens/bootstrap/v1
import { paths } from "@reservoir0x/reservoir-kit-client";

export type Token = NonNullable<
  paths["/tokens/v5"]["get"]["responses"]["200"]["schema"]["tokens"]
>[0];

export default async function getTokens(contract: string): Promise<Token[]> {
  const response = await fetch(
    `https://api-goerli.reservoir.tools/tokens/v5?collection=${contract}&sortBy=floorAskPrice`
  );

  if (response.status === 200) {
    const data = await response.json();
    return data.tokens;
  }

  return [];
}
