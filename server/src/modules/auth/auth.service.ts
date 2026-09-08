import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { database } from '../../database/knex';
import { config } from '../../config/env';
import type { RegisterInput, LoginInput } from './auth.schemas';

const BCRYPT_ROUNDS = 12;

export interface AuthUser {
  id: string;
  shop_id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface AuthShop {
  id: string;
  name: string;
  owner_name: string | null;
  contact_number: string | null;
  address: string | null;
  currency: string;
  rush_fee_centavos: number;
  created_at: string;
  updated_at: string;
}

export interface AuthPayload {
  userId: string;
  shopId: string;
  email: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

export async function register(input: RegisterInput): Promise<{ user: AuthUser; shop: AuthShop; token: string }> {
  const normalizedEmail = input.email.toLowerCase().trim();

  const existing = await database('users').where({ email: normalizedEmail }).first();
  if (existing) {
    const err = new Error('Email already registered') as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }

  const shopId = randomUUID();
  const userId = randomUUID();
  const now = nowIso();
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // Transaction: create shop + user
  await database.transaction(async (trx) => {
    await trx('shops').insert({
      id: shopId,
      name: input.shopName.trim(),
      owner_name: input.ownerName.trim(),
      contact_number: null,
      address: null,
      currency: 'PHP',
      rush_fee_centavos: 0,
      created_at: now,
      updated_at: now,
    });

    await trx('users').insert({
      id: userId,
      shop_id: shopId,
      email: normalizedEmail,
      password_hash: passwordHash,
      name: input.ownerName.trim(),
      created_at: now,
      updated_at: now,
    });
  });

  const shop = (await database('shops').where({ id: shopId }).first()) as AuthShop;
  const user = (await database('users').where({ id: userId }).first()) as unknown as AuthUser & { password_hash: string };

  const token = signToken({ userId, shopId, email: normalizedEmail });

  return {
    user: {
      id: user.id,
      shop_id: user.shop_id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    },
    shop,
    token,
  };
}

export async function login(input: LoginInput): Promise<{ user: AuthUser; shop: AuthShop; token: string }> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const userRow = await database('users').where({ email: normalizedEmail }).first();
  if (!userRow) {
    const err = new Error('Invalid email or password') as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(input.password, userRow.password_hash as string);
  if (!valid) {
    const err = new Error('Invalid email or password') as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }

  const shop = (await database('shops').where({ id: userRow.shop_id }).first()) as AuthShop | undefined;
  if (!shop) {
    const err = new Error('Associated shop not found') as Error & { statusCode?: number };
    err.statusCode = 500;
    throw err;
  }

  const token = signToken({ userId: userRow.id, shopId: userRow.shop_id, email: userRow.email });

  return {
    user: {
      id: userRow.id,
      shop_id: userRow.shop_id,
      email: userRow.email,
      name: userRow.name,
      created_at: userRow.created_at,
    },
    shop,
    token,
  };
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, config.jwtSecret) as AuthPayload;
}
