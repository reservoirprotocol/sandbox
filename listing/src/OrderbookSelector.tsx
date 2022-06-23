import React, { FC } from 'react'
import { Orderbook } from './List'

type Props = {
  setOrderbook: React.Dispatch<React.SetStateAction<Orderbook>>
}

const OrderbookSelector: FC<Props> = ({ setOrderbook }) => {
  return (
    <>
      <label style={{ marginRight: 10 }} htmlFor="orderbook">
        Orderbook
      </label>
      <select
        name="orderbook"
        id="orderbook"
        defaultValue="reservoir"
        onChange={(e) => setOrderbook(e.target.value as Orderbook)}
      >
        {['opensea', 'looks-rare', 'reservoir'].map((orderKind) => (
          <option key={orderKind} value={orderKind}>
            {orderKind}
          </option>
        ))}
      </select>
    </>
  )
}

export default OrderbookSelector
