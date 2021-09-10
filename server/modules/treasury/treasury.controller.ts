import { Get, Post, Body, Param, Res, Req, JsonController, Authorized, CurrentUser, QueryParam } from 'routing-controllers';
import { Inject } from 'typedi';
import { Request, Response } from 'express';
import { Current } from '@aitheon/core-server';
import { OpenAPI } from 'routing-controllers-openapi';
import { TreasuryService } from './treasury.service';
import * as moment from 'moment';

@Authorized()
@JsonController('/api/treasury')
export class TreasuryController {


  @Inject(() => TreasuryService)
  treasuryService: TreasuryService;

  @Get('/accounts')
  @OpenAPI({ summary: 'Get treasury accounts', operationId: 'listAccounts' })
  async accounts(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    const accounts = await this.treasuryService.listAccounts(current.user._id, current.organization ? current.organization._id : undefined);
    return response.json(accounts);
  }


  @Get('/exchange-rate')
  @OpenAPI({ summary: 'Get current exchange rate', operationId: 'currentExchangeRate' })
  async currentExchangeRate(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    const exchange = await this.treasuryService.currentExchangeRate();
    return response.json(exchange);
  }

  @Post('/charge/:account')
  @OpenAPI({ summary: 'Get current exchange rate', operationId: 'chargeCard' })
  async chargeCard(@CurrentUser() current: Current, @Body() body: any,
    @Param('account') account: string, @Res() response: Response, @Req() request: Request) {

    try {
      const purchase = await this.treasuryService.chargeCard(account, body.amount, current);
      return response.json(purchase);
    } catch (err) {
      return response.status(400).send({message: err.message});
    }
  }


  @Post('/charge-fait/:account')
  @OpenAPI({ summary: 'Get current exchange rate', operationId: 'chargeFaitAccount' })
  async chargeFaitAccount(@CurrentUser() current: Current, @Body() body: any,
    @Param('account') account: string, @Res() response: Response, @Req() request: Request) {
    try {
      const purchase = await this.treasuryService.chargeFaitAccountCard(account, body.amount, current, body.description);
      return response.json(purchase);
    } catch (err) {
      return response.status(400).send({message: err.message});
    }
  }

  @Get('/fiat-accounts')
  @OpenAPI({ summary: 'Get fiat accounts', operationId: 'fiatAccounts' })
  async fiatAccounts(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    const accounts = await this.treasuryService.listFiatAccount(current.user._id, current.organization ? current.organization._id : undefined);
    return response.json(accounts);
  }


  @Get('/billing-transactions')
  @OpenAPI({ summary: 'Get fiat accounts', operationId: 'billingTransactions`' })
  async billingTransactions(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @QueryParam('fromDate') fromDate: string, @QueryParam('toDate') toDate: string) {
    const transactions = await this.treasuryService.listBillingTransactions(current.user._id, current.organization ? current.organization._id : undefined,
       moment(fromDate).startOf('day').toISOString(), moment(toDate).endOf('day').toISOString());
    return response.json(transactions);
  }

  @Post('/fiat-accounts/inbound')
  @OpenAPI({ summary: 'Create Inbound fiat account', operationId: 'createInboundFiatAccount' })
  async createInboundFiatAccount(@CurrentUser() current: Current, @Res() response: Response, @Body() body: any, @Req() request: Request) {
    if (current.organization) {
      body.organization = current.organization._id;
    } else {
      body.user = current.user._id;
    }
    const accounts = await this.treasuryService.createFiatInboundAccount(body);
    if (!accounts) {
      return response.status(400).send({message: 'Invalid card details'});
    }
    return response.json(accounts);
  }


  @Get('/fiat-accounts/inbound')
  @OpenAPI({ summary: 'List active inbound Fait accounts', operationId: 'listInboundFiatAccounts' })
  async listInboundFiatAccounts(@CurrentUser() current: Current, @Res() response: Response, @Body() body: any, @Req() request: Request) {
    const accounts = await this.treasuryService.listActiveInboundFiatAccounts(current.user._id, current.organization ? current.organization._id : undefined);
    return response.json(accounts);
  }

  @Get('/balance/acu')
  @OpenAPI({ summary: 'Get ACU Balance', operationId: 'acuBalance' })
  async acu(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {
    const result  = await this.treasuryService.aitheonAccountBalance(current.user._id, current.organization ? current.organization._id : undefined);
    if (result.fiatAccountStatus.disabled) {
      response.setHeader('X-Fiat-Status', 'disabled');
    }
    return response.json(result.acuBalance);
  }

  @Get('/balance/organization-trial')
  @OpenAPI({ summary: 'Get organization trial balance', operationId: 'organizationTrialBalance' })
  async orgTrialBalance(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request) {

    if (!current.organization || current.organization && current.organization._id && (current.user._id !== current.organization.createdBy)) {
      return response.status(204).send();
    }
    const trialBalance = await this.treasuryService.organizationTrialBalance(current.organization.createdBy);
    return response.json(trialBalance);
  }



}
