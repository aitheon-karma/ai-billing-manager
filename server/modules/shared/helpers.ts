import { validate } from 'class-validator';
import { ErrorPldInvalid } from '../core/errors';
import { plainToClass } from 'class-transformer';

export const envAccessComparer = (requiredAccess: any, currentAccess: any) => {
  let access;
  switch (currentAccess) {
    case 'ALPHA':
      access = requiredAccess === 'PROD' || requiredAccess === 'BETA' || requiredAccess === 'ALPHA';
      break;
    case 'BETA':
      access = requiredAccess === 'PROD' || requiredAccess === 'BETA';
      break;
    case 'PROD':
      access = requiredAccess === 'PROD';
      break;
  }
  return access;
};

const hiddenServices = ['ADMIN'];

export const envAccessChecker = (allServices: any, checkServiceId: string, userEnv: any) => {

  const service = allServices.find((s: any) => {
    return s._id.toString() === checkServiceId;
  });
  if (!service || hiddenServices.includes(checkServiceId)) {
    return false;
  }

  return envAccessComparer(service.envStatus, userEnv);
};

export const objectIdStringGetter = (v: {toString?: Function}) => (typeof v !== 'undefined' && v !== null && v.toString) ? v.toString() : v;


export async function isValidInstance(cls: any, val: any): Promise<boolean> {
  const instance = plainToClass(cls, val);
  const errors = await validate(instance, {validationError: { target: false }});
  if (errors.length > 0) {
    throw new ErrorPldInvalid(JSON.stringify(errors));
  }
  return true;
}

export function deriveClass(cls: any, val: any): typeof cls {
  return plainToClass(cls, val);
}

export async function validateInstance(instance: any) {
  const errors = await validate(instance, {validationError: { target: false }});
  if (errors.length > 0) {
    throw new ErrorPldInvalid(JSON.stringify(errors));
  }
  return true;
}
