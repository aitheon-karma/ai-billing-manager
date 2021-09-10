import { Middleware, ExpressErrorMiddlewareInterface } from 'routing-controllers';
import { logger } from '@aitheon/core-server';
import { Response, Request } from 'express';
import { environment } from '../../environment';
import ErrorService from './errors';
import { Inject } from 'typedi';

@Middleware({ type: 'after' })
export class ErrorHandler implements ExpressErrorMiddlewareInterface {

  @Inject()
  errorService: ErrorService;

  error(error: any, request: Request, response: Response, next: (err: any) => any) {
    return this.errorService.errorResponse(response, error);
  }


}