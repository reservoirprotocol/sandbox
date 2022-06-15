//https://api.reservoir.tools/tokens/bootstrap/v1

export default async function getCollectionFloor(collection) {
  const response = await fetch(
    `https://api-rinkeby.reservoir.tools/tokens/bootstrap/v1?collection=${collection}&limit=5`
  );

  if (response.status === 200) {
    const data = await response.json();
    return data.tokens;
  }

  return [];
}
