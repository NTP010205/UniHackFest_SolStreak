import { z } from 'zod';

export const MAX_API_BODY_BYTES = 4_096;

export class ApiRequestError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = MAX_API_BODY_BYTES,
): Promise<T> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new ApiRequestError('UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json', 415);
  }
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiRequestError('BODY_TOO_LARGE', 'Request body is too large', 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ApiRequestError('BODY_TOO_LARGE', 'Request body is too large', 413);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiRequestError('INVALID_JSON', 'Request body must be valid JSON', 400);
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiRequestError('INVALID_REQUEST', 'Invalid request', 400);
  return parsed.data;
}

export function parseWalletQuery(request: Request, walletSchema: z.ZodType<string>) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => key !== 'wallet') || params.getAll('wallet').length !== 1) {
    throw new ApiRequestError('INVALID_REQUEST', 'Invalid request', 400);
  }
  const wallet = walletSchema.safeParse(params.get('wallet'));
  if (!wallet.success) throw new ApiRequestError('INVALID_REQUEST', 'Invalid request', 400);
  return wallet.data;
}
