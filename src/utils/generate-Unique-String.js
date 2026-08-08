import { customAlphabet } from 'nanoid'

 export const generateUniqueString = (length) => {

    const nanoid = customAlphabet('A–Za–z0–9', length || 13)
    return nanoid()
}   


