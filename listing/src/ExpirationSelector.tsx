import React, { FC } from 'react'

type Props = {
  presets: {
    preset: string
    value: () => string
    display: string
  }[]
  expiration: string
  setExpiration: React.Dispatch<React.SetStateAction<string>>
}

const ExpirationSelector: FC<Props> = ({
  presets,
  expiration,
  setExpiration,
}) => {
  return (
    <>
      <label style={{ marginRight: 10 }} htmlFor="expirationSelector">
        Expiration
      </label>
      <select
        name="expiration"
        id="expirationSelector"
        defaultValue={expiration}
        onChange={(e) => setExpiration(e.target.value)}
      >
        {presets.map(({ preset, display }) => (
          <option key={preset} value={preset}>
            {display}
          </option>
        ))}
      </select>
    </>
  )
}

export default ExpirationSelector
