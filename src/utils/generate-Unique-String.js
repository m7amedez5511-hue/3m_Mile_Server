import { customAlphabet } from 'nanoid'

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export const generateUniqueString = (length) => {
  const nanoid = customAlphabet(ALPHABET, length || 13)
  return nanoid()
}