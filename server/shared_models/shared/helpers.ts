import { validate } from 'class-validator';
import { plainToClass, plainToClassFromExist } from 'class-transformer';

export const DEFAULT_PRECISION = 8;

export function toRoundedNumber(n: number, p?: number) {
  if (typeof n !== 'number' || Number.isFinite(n) !== true) {
    throw new Error('Provided argument is not a number');
  }
  p = (typeof p !== 'undefined' && Number.isFinite(p) && p > 0) ? p : DEFAULT_PRECISION;
  return parseFloat(n.toFixed(p));
}

export const objectIdStringGetter = (v: {toString?: Function}) => (typeof v !== 'undefined' && v !== null && v.toString) ? v.toString() : v;
export async function isValidInstance(cls: any, val: any): Promise<boolean> {
  const instance = plainToClass(cls, val);
  const errors = await validate(instance, {validationError: { target: false }});
  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors));
  }
  return true;
}

export function deriveClass(cls: any, val: any): typeof cls {
  return plainToClass(cls, val);
}

export function deriveClassFromExisting(cls: any, val: any): typeof cls {
  return plainToClassFromExist(cls, val);
}

export async function validateInstance(instance: any) {
  const errors = await validate(instance, {validationError: { target: false }});
  return errors;
}
