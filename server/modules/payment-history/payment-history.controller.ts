import { Get, Res, Req, JsonController, Authorized, CurrentUser, QueryParam, Param, Post, Put, Patch, Delete, Body } from 'routing-controllers';
import { Request, Response } from 'express';
import { Inject } from 'typedi';
import { Current } from '@aitheon/core-server';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { PaymentHistoryService } from './payment-history.service';
import { PaymentHistory } from './payment-history.model';

@JsonController('/api/payment-history')
export class PaymentHistoryController {

  @Inject(() => PaymentHistoryService)
  paymentHistoryService: PaymentHistoryService;

  @Authorized(['Owner', 'SuperAdmin'])
  @Get('/')
  @ResponseSchema(PaymentHistory, { isArray: true })
  @OpenAPI({ summary: 'Organization payment history', operationId: 'getOrgHistory' })
  async getOrgHistory(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request): Promise<any> {
    const paymentHistoryEntries = await this.paymentHistoryService.getPaymentHistoryEntries(current.organization._id);
    return response.json(paymentHistoryEntries);
  }

}
