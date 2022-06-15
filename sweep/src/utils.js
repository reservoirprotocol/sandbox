export function setParams(url: URL, query: { [x: string]: any }) {
  Object.keys(query).map((key) =>
    url.searchParams.set(key, query[key]?.toString())
  );
}

export async function pollUntilHasData(url: URL, index: number) {
  async function getData() {
    let res = await fetch(url.href);

    return res.data;
  }

  const json = await getData();

  // Check if the data exists
  if (json?.steps?.[index]?.data) return json;

  // The response is still unchanged. Check again in five seconds
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await pollUntilHasData(url, index);
}
