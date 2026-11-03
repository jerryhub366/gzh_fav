import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Lab 不走 admin 登录：每个浏览器第一次访问时发一个随机身份（cookie），卡片按身份隔离。
// 换设备用同步链接 /lab#/sync/<身份> 把同一个身份带过去；agent 用 x-lab-owner 头。

export const OWNER_COOKIE = 'invest_lab_owner';
export const OWNER_HEADER = 'x-lab-owner';
const OWNER_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export function isValidOwner(value: string | null | undefined): value is string {
  return Boolean(value && OWNER_PATTERN.test(value));
}

export function resolveOwner(request: NextRequest) {
  const fromHeader = request.headers.get(OWNER_HEADER);
  if (isValidOwner(fromHeader)) return { owner: fromHeader, isNew: false };
  const fromCookie = request.cookies.get(OWNER_COOKIE)?.value;
  if (isValidOwner(fromCookie)) return { owner: fromCookie, isNew: false };
  return { owner: randomBytes(18).toString('base64url'), isNew: true };
}

export function setOwnerCookie(response: NextResponse, owner: string) {
  response.cookies.set(OWNER_COOKIE, owner, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365 * 5,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

// 只在新发身份时写 cookie，其余请求不动它。
export function withOwner(response: NextResponse, ident: { owner: string; isNew: boolean }) {
  return ident.isNew ? setOwnerCookie(response, ident.owner) : response;
}
