import { Get, Res, Req, JsonController, Authorized, CurrentUser, QueryParam, Param, Post, Put, Patch, Delete, Body } from 'routing-controllers'; '';
import { Inject } from 'typedi';
import { Request, Response } from 'express';
import { Current } from '@aitheon/core-server';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { ErrorForbidden, ErrorBadInput } from '../../core/errors';
import { SubscriptionPriceModifiersService } from './subscription-price-modifiers.service';
import { SubscriptionPriceModifier } from './subscription-price-modifiers.model';
import { SUBSCRIPTION_ENTITIES } from '../subscriptions/subscription.model';
import { isValidInstance } from '../../shared/helpers';

@Authorized()
@JsonController('/api/subscription-price-modifiers')
export class SubscriptionPriceModifiersController {

  @Inject()
  private priceModifiersService: SubscriptionPriceModifiersService;

  @Get('/')
  @OpenAPI({ summary: 'List price modifiers', operationId: 'listPriceModifiers' })
  async listPriceModifiers(
    @CurrentUser() current: Current,
    @Res() response: Response,
    @Req() request: Request,
    @QueryParam('service') service?: string,
    @QueryParam('type') type?: SUBSCRIPTION_ENTITIES,
    @QueryParam('reference') reference?: string,
    @QueryParam('date') date?: string,
  ) {
    if (type) {
      await isValidInstance(SUBSCRIPTION_ENTITIES, type);
    }
    let parsedDate;
    if (date) {
      parsedDate = new Date(date);

      // magic isNaN conversion
      // @ts-ignore
      if (Object.prototype.toString.call(parsedDate) !== '[object Date]' || isNaN(parsedDate)) {
        throw new ErrorBadInput('Invalid date');
      }
    }
    return {modifiers: await this.priceModifiersService.findModifiers(service, type, reference, parsedDate)};
  }

  @Post('/')
  @OpenAPI({ summary: 'Create price modifier', operationId: 'create' })
  async create(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Body() priceModifier: SubscriptionPriceModifier) {
    if (!current.user.sysadmin) {
      throw new ErrorForbidden('Action only allowed by sysadmin');
    }
    await isValidInstance(SubscriptionPriceModifier, priceModifier);
    return await this.priceModifiersService.createPriceModifier(priceModifier);
  }

  @Put('/:priceModifierId')
  @OpenAPI({ summary: 'Update price modifier', operationId: 'update' })
  async update(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Param('priceModifierId') priceModifierId: string, @Body() priceModifier: SubscriptionPriceModifier) {
    if (!current.user.sysadmin) {
      throw new ErrorForbidden('Action only allowed by sysadmin');
    }
    await isValidInstance(SubscriptionPriceModifier, priceModifier);
    await isValidInstance(String, priceModifierId);
    return await this.priceModifiersService.updatePriceModifier(priceModifierId, priceModifier);
  }

  @Delete('/:priceModifierId')
  @OpenAPI({ summary: 'Delete price modifier', operationId: 'delete' })
  async delete(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Param('priceModifierId') priceModifierId: string) {
    if (!current.user.sysadmin) {
      throw new ErrorForbidden('Action only allowed by sysadmin');
    }
    await isValidInstance(String, priceModifierId);
    return await this.priceModifiersService.deletePriceModifier(priceModifierId);
  }

}
