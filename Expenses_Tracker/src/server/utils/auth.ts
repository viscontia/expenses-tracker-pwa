import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '~/server/db'
import type { User as PrismaUser } from '@prisma/client'

export interface UserPreferences {
	theme?: 'light' | 'dark'
	defaultCurrency?: string
	currencyOrder?: string[]
	chartCategoryCount?: number
}

export interface User extends Omit<PrismaUser, 'password' | 'preferences'> {
	preferences: UserPreferences | null
}

export interface UserJWTPayload {
	id: number
	email: string
}

export const hashPassword = async (password: string) => {
	return bcrypt.hash(password, 12)
}

export const verifyPassword = async (password: string, hash: string) => {
	return bcrypt.compare(password, hash)
}

export const signToken = (id: number, secret: string) => {
	return jwt.sign({ id }, secret, {
		expiresIn: '7d',
	})
}

export const verifyToken = (
	token: string,
	secret: string,
): UserJWTPayload => {
	const decoded = jwt.verify(token, secret) as UserJWTPayload
	return decoded
}
