//https://api.reservoir.tools/tokens/bootstrap/v1

import { paths } from "@reservoir0x/reservoir-kit-client";

export type Token = NonNullable<
  paths["/tokens/v4"]["get"]["responses"]["200"]["schema"]["tokens"]
>[0];

export default async function getCollectionFloor(
  collection: string
): Promise<Token[]> {
  const response = await fetch(
    `https://api-rinkeby.reservoir.tools/tokens/v4?collection=${collection}&limit=${10}`
  );

  if (response.status === 200) {
    const data = await response.json();
    return data.tokens;
  }

  return [];
}
