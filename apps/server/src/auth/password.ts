import { randomBytes, scrypt, timingSafeEqual } from 'crypto'

const SALT_BYTES = 16
const KEY_BYTES = 32
const ITERATIONS = 100_000
const BLOCK_SIZE = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`)
    })
  })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [saltHex, keyHex] = hash.split(':')
  const salt = Buffer.from(saltHex!, 'hex')
  const expectedKey = Buffer.from(keyHex!, 'hex')
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(timingSafeEqual(expectedKey, derivedKey))
    })
  })
}
