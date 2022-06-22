//https://api.reservoir.tools/tokens/bootstrap/v1
import { paths } from '@reservoir0x/client-sdk'

export type Token = NonNullable<
  paths['/users/{user}/tokens/v2']['get']['responses']['200']['schema']['tokens']
>[0]

export default async function getTokens(user: string): Promise<Token[]> {
  const response = await fetch(
    `https://api-rinkeby.reservoir.tools/users/${user}/tokens/v2?limit=10`
  )

  if (response.status === 200) {
    const data = await response.json()
    return data.tokens
  }

  return []
}
