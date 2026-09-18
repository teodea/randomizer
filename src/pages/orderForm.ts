import type { Order } from '../mixer/engine'

/** The order settings as the form holds them; the block size stays text until the mix is built. */
export interface OrderForm {
  mode: Order['mode']
  blockSize: string
  spreadArtists: boolean
}

export const defaultOrderForm: OrderForm = {
  mode: 'random',
  blockSize: '3',
  spreadArtists: true,
}

/** The engine order for a form, or null while the block size is unusable. */
export function toOrder(form: OrderForm): Order | null {
  if (form.mode !== 'blocks') return { mode: form.mode }
  const size = Number(form.blockSize)
  return Number.isInteger(size) && size > 0 ? { mode: 'blocks', size } : null
}
