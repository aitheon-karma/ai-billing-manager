import { Get, Post, Delete, Body, Param, Res, Req, JsonController, Authorized, CurrentUser, QueryParam } from 'routing-controllers';
import { Inject } from 'typedi';
import { Request, Response } from 'express';
import { Current } from '@aitheon/core-server';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Price } from './price/price.model';
import {  PriceService } from './price/price.service';
import * as moment from 'moment';
import { StatisticsService } from './statistics/statistics.service';


@Authorized()
@JsonController('/api/admin')
export class AdminController {

  @Inject()
  private priceService: PriceService;

  @Inject()
  private statisticsService: StatisticsService;



  @Post('/prices')
  @ResponseSchema(Price)
  @OpenAPI({ summary: 'Create Price for a service', operationId: 'createPrice' })
  async createPrice(@CurrentUser() current: Current, @Body() price: Price, @Res() response: Response, @Req() request: Request) {
    const isAdmin = current.user.sysadmin;
    if (!isAdmin) {
      return response.status(403).send({message: 'Forbidden'});
    }
    price.startFrom = moment(price.startFrom).startOf('day').toDate();

    try {
      price = await this.priceService.create(price);
      return response.json(price);
    } catch (err) {
      return response.json(err);
    }

  }


  @Get('/prices')
  @ResponseSchema(Price, {isArray: true})
  @OpenAPI({ summary: 'Get prices', operationId: 'getPrices' })
  async getPrices(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @QueryParam('type') type: string) {

    const prices =  await this.priceService.findByParam({type});
    return response.json(prices);

  }

  @Delete('/prices/:id')
  @ResponseSchema(Price, {isArray: true})
  @OpenAPI({ summary: 'Delete a price', operationId: 'deletePrice' })
  async deletePrice(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @Param('id') id: string) {
    const isAdmin = current.user.sysadmin;
    if (!isAdmin) {
      return response.status(403).send({message: 'Forbidden'});
    }
    const deletedPrice = await this.priceService.delete(id);
    return response.json(deletedPrice);
  }


  @Get('/statistics/usage-by-date')
  @OpenAPI({ summary: 'get statistics usage by date for all date', operationId: 'statisticsByDate' })
  async staticsByDate(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @QueryParam('startDate') startDate: string, @QueryParam('endDate') endDate: string ) {
     const result = await this.statisticsService.findByDate(moment(startDate).startOf('day').toISOString(), moment(endDate).endOf('day').toISOString());
     return response.json(result);
  }

  @Get('/statistics/usage-by-service')
  @OpenAPI({ summary: 'get statistics usage by date for all date', operationId: 'statisticsByService' })
  async staticsByService(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @QueryParam('startDate') startDate: string, @QueryParam('endDate') endDate: string ) {
     const result = await this.statisticsService.findByService(moment(startDate).startOf('day').toDate(), moment(endDate).endOf('day').toDate());
     return response.json(result);
  }


}
