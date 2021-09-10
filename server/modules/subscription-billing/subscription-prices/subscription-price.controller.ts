import { Get, Res, Req, JsonController, Authorized, CurrentUser, QueryParam, Param, Post, Put, Patch, Delete, Body } from 'routing-controllers'; '';
import { Inject } from 'typedi';
import { Request, Response } from 'express';
import { Current } from '@aitheon/core-server';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import * as _ from 'lodash';
import { SubscriptionPriceService } from './subscription-price.service';
import { SubscriptionPrice } from './subscription-price.model';
import { SUBSCRIPTION_ENTITIES } from '../subscriptions/subscription.model';
import { ErrorForbidden } from '../../core/errors';
import { isValidInstance } from '../../shared/helpers';

@Authorized()
@JsonController('/api/subscription-prices')
export class SubscriptionPriceController {

  @Inject()
  private priceService: SubscriptionPriceService;

  @Get('/')
  @OpenAPI({ summary: 'List prices', operationId: 'listPrices' })
  async listPrices(
    @CurrentUser() current: Current,
    @Res() response: Response,
    @Req() request: Request,
    @QueryParam('active') active?: boolean,
    @QueryParam('service') service?: string,
    @QueryParam('type') type?: SUBSCRIPTION_ENTITIES,
    @QueryParam('reference') reference?: string,
    @QueryParam('includeModifiers') includeModifiers?: boolean,
  ) {
    let prices;
    if (type) {
      await isValidInstance(SUBSCRIPTION_ENTITIES, type);
    }
    if (active) {
      prices = await this.priceService.getActivePrice([service], type, reference, includeModifiers);
    } else {
      prices = await this.priceService.list(service);
    }
    return response.json(prices);
  }

  @Get('/:priceId')
  @OpenAPI({ summary: 'Get specific price', operationId: 'getSpecificPrice' })
  async getSpecificPrice(
    @CurrentUser() current: Current,
    @Res() response: Response,
    @Req() request: Request,
    @Param('priceId') priceId: string,
    @QueryParam('includeModifiers') includeModifiers?: boolean,
  ) {
    const price = await this.priceService.findPrice(
      priceId, includeModifiers,
      current.organization ? SUBSCRIPTION_ENTITIES.ORGANIZATION : SUBSCRIPTION_ENTITIES.USER,
      current.organization ? current.organization._id : current.user._id
    );
    return response.json(price);
  }

  @Post('/')
  @OpenAPI({ summary: 'Create prices', operationId: 'create' })
  async create(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Body() price: SubscriptionPrice) {
    if (!current.user.sysadmin) {
      throw new ErrorForbidden('Action only allowed by sysadmin');
    }
    await isValidInstance(SubscriptionPrice, price);
    const createdPrice = await this.priceService.create(current.user._id, price);
    return response.json(createdPrice);
  }

  @Put('/:priceId')
  @OpenAPI({ summary: 'Update price', operationId: 'update' })
  async update(
    @CurrentUser() current: Current,
    @Res() response: Response,
    @Req() request: Request,
    @Param('priceId') priceId: string,
    @Body() price: SubscriptionPrice
  ) {
    if (!current.user.sysadmin) {
      throw new ErrorForbidden('Action only allowed by sysadmin');
    }
    await isValidInstance(SubscriptionPrice, price);
    const updatedPrice = await this.priceService.update(priceId, price);
    return response.json({success: updatedPrice});
  }

  @Delete('/:priceId')
  @OpenAPI({ summary: 'Delete price', operationId: 'delete' })
  async delete(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Param('priceId') priceId: string) {
    if (!current.user.sysadmin) {
      throw new ErrorForbidden('Action only allowed by sysadmin');
    }
    const deletedPrice = await this.priceService.delete(priceId);
    return response.json({success: deletedPrice === true});
  }

}
