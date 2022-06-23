import React, { FC } from 'react'
import { OrderKind } from './List'

type Props = {
  setOrderKind: React.Dispatch<React.SetStateAction<OrderKind>>
}

const OrderKindSelector: FC<Props> = ({ setOrderKind }) => {
  return (
    <>
      <label style={{ marginRight: 10 }} htmlFor="orderKindSelector">
        Order Kind
      </label>
      <select
        name="order-kind"
        id="orderKindSelector"
        defaultValue="seaport"
        onChange={(e) => setOrderKind(e.target.value as OrderKind)}
      >
        {['721ex', 'looks-rare', 'wyvern-v2.3', 'zeroex-v4', 'seaport'].map(
          (orderKind) => (
            <option key={orderKind} value={orderKind}>
              {orderKind}
            </option>
          )
        )}
      </select>
    </>
  )
}

export default OrderKindSelector
