import { Get, Res, Req, JsonController, Authorized, CurrentUser, QueryParam, Param, Post, Put, Patch, Delete, Body } from 'routing-controllers';
import { Request, Response } from 'express';
import { Inject } from 'typedi';
import { Current, logger, Organization } from '@aitheon/core-server';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { SubscriptionService, SubscriptionAddUsers } from './subscriptions.service';
import { Subscription } from './subscription.model';
import { SubscriptionDetails } from './subscription-details.service';
import { isValidInstance } from '../../shared/helpers';
import * as common from '../../../shared_models/common';

@JsonController('/api/subscriptions')
export class SubscriptionController {

  @Inject()
  subscriptionService: SubscriptionService;

  @Authorized()
  @Get('/info')
  @OpenAPI({ summary: 'Subscription Info', operationId: 'subscriptionInfo' })
  @ResponseSchema(SubscriptionDetails)
  async subscriptionInfo(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @QueryParam('service') service: string) {
    await isValidInstance(String, service);
    const result = await this.subscriptionService.subscriptionInfo(current, service);
    return response.json(result);
  }

  @Authorized(['Owner', 'SuperAdmin'])
  @Post('/')
  @OpenAPI({ summary: 'Create subscription info', operationId: 'create' })
  async create(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Body() subscription: Subscription) {
    await isValidInstance(Subscription, subscription);
    const result = await this.subscriptionService.createSubscription(current.user._id, current.organization._id, subscription);
    return response.json(result);
  }

  @Authorized(['Owner', 'SuperAdmin'])
  @Put('/service/:serviceId')
  @OpenAPI({ summary: 'Update subscription info', operationId: 'update' })
  async update(
    @CurrentUser() current: Current,
    @Res() response: Response,
    @Req() request: Request,
    @Param('serviceId') serviceId: string,
    @Body() update: common.SubscriptionUpdatePayload
  ) {
    await isValidInstance(common.SubscriptionUpdatePayload, update);
    const result = await this.subscriptionService.updateSubscription(current, current.user._id, current.organization._id, serviceId, update);
    return response.json({success: true});
  }

  @Authorized(['Owner', 'SuperAdmin'])
  @Post('/services/add-seats')
  @OpenAPI({ summary: 'Add seats to services', operationId: 'updateSeatsCount' })
  async updateUsersCount(
    @CurrentUser() current: Current,
    @Res() response: Response,
    @Req() request: Request,
    @Body() update: SubscriptionAddUsers
  ) {
    await isValidInstance(SubscriptionAddUsers, update);
    const result = await this.subscriptionService.updateSeatsCount(current, current.user._id, current.organization._id, update);
    return response.json({success: true});
  }

  @Authorized(['Owner', 'SuperAdmin'])
  @Delete('/:subscriptionId')
  @OpenAPI({ summary: 'Delete subscription info', operationId: 'delete' })
  async delete(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Param('subscriptionId') subscriptionId: string) {
    await isValidInstance(String, subscriptionId);
    const result = await this.subscriptionService.deleteSubscription(subscriptionId);
    return response.json(result);
  }

}