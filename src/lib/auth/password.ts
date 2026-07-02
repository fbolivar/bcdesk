import bcrypt from 'bcryptjs'

const ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(password, hash)
}
