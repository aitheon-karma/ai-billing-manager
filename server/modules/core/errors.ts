import { Response } from 'express';
import Container, { Service } from 'typedi';
import { logger } from '@aitheon/core-server';

export enum ERROR_DEFAULTS {
  SERVER_ERROR_MESSAGE = 'Internal Server Error',
  SERVER_ERROR_CODE = 500
}

export enum API_ERROR_NAMES {
  AERR_NOT_FOUND = 'AERR_NOT_FOUND',
  AERR_STATE_CNFLT = 'AERR_STATE_CNFLT',
  AERR_STATE_UNDEF = 'AERR_STATE_UNDEF',
  AERR_NOT_ATHORZD = 'AERR_NOT_ATHORZD',
  AERR_BAD_INPUT = 'AERR_BAD_INPUT',
  AERR_ACTN_FORBDN = 'AERR_ACTN_FORBDN',
  AERR_PLD_INVALID = 'AERR_PLD_INVALID'
}

export const API_ERROR_STATUS_CODES: { [key: string]: number } = {
  [API_ERROR_NAMES.AERR_BAD_INPUT]: 400,
  [API_ERROR_NAMES.AERR_NOT_ATHORZD]: 401,
  [API_ERROR_NAMES.AERR_ACTN_FORBDN]: 403,
  [API_ERROR_NAMES.AERR_NOT_FOUND]: 404,
  [API_ERROR_NAMES.AERR_STATE_CNFLT]: 409,
  [API_ERROR_NAMES.AERR_STATE_UNDEF]: 500,
  [API_ERROR_NAMES.AERR_PLD_INVALID]: 400
};

@Service()
export default class ErrorService {

  errorResponse = function (res: Response, err: Error | CustomError): void {
    if (err instanceof CustomError && API_ERROR_STATUS_CODES[err.code]) {
      res.status(API_ERROR_STATUS_CODES[err.code])
        .send({ success: false, message: err.message });
    } else {
      switch (err.name) {
        case 'AccessDeniedError':
        case 'AuthorizationRequiredError':
          logger.info('[AUTH] AccessDeniedError: ', err.message);
          res.sendStatus(401);
        default:
          logger.error(err);
          res.status(ERROR_DEFAULTS.SERVER_ERROR_CODE)
            .send({ success: false, message: ERROR_DEFAULTS.SERVER_ERROR_MESSAGE });
      }
    }
  };
}

export class CustomError extends Error {
  code: string;

  constructor(message: string, errName: API_ERROR_NAMES) {
    super(message);
    this.code = errName;
    this.name = this.constructor.name;
    this.message = message;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ErrorNotFound extends CustomError {
  constructor(message: string) {
    super(message, API_ERROR_NAMES.AERR_NOT_FOUND);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ErrorUndefinedState extends CustomError {
  constructor(message: string) {
    super(message, API_ERROR_NAMES.AERR_STATE_UNDEF);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ErrorConflict extends CustomError {
  constructor(message: string) {
    super(message, API_ERROR_NAMES.AERR_STATE_CNFLT);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ErrorNotAuthorized extends CustomError {
  constructor(message: string) {
    super(message, API_ERROR_NAMES.AERR_NOT_ATHORZD);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ErrorBadInput extends CustomError {
  constructor(message: string) {
    super(message, API_ERROR_NAMES.AERR_BAD_INPUT);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ErrorForbidden extends CustomError {
  constructor(message: string) {
    super(message, API_ERROR_NAMES.AERR_ACTN_FORBDN);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ErrorPldInvalid extends CustomError {
  constructor(message: string) {
    super(message, API_ERROR_NAMES.AERR_PLD_INVALID);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

