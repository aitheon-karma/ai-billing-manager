import { Get, Res, JsonController } from 'routing-controllers';
import { Inject } from 'typedi';
import { Request, Response } from 'express';
import { Current } from '@aitheon/core-server';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { TreasuryService } from '../../treasury/treasury.service';
import { PriceService } from '../admin/price/price.service';
import * as _ from 'lodash';
import { PriceType } from '../admin/price/price.model';


@JsonController('/api/public')
export class PublicController {

  @Inject()
  treasuryService: TreasuryService;

  @Inject()
  priceService: PriceService;

  @Get('/prices')
  async getPrices(@Res() response: Response) {
    try {
      const prices = await this.priceService.getAll();
      const now = new Date();
      const services = _.chain(prices).groupBy('service').map((value, key) => ({ service: key, prices: value })).value();
      const results = [];

      for (const service of services) {
        // fixed at organization for now
        const servicePricesTillNow = service.prices.filter(sp => (sp.type === PriceType.ORGANIZATION)).filter(p => p.startFrom <= now);
        if (servicePricesTillNow.length) {
          const servicePrices = servicePricesTillNow.sort((p1, p2) => ((new Date(p1.startFrom)).getTime() - (new Date(p2.startFrom)).getTime())).pop();
          if (!servicePrices) {
            continue;
          }
          results.push({
            service: servicePrices.service,
            price: servicePrices.pricePerSecond * 3600,
            currency: 'USD',
            period: 'HOURLY'
          });
        }
      }
      return response.json(results);
    } catch (err) {
      return response.status(501).send({message: 'Error getting prices'});
    }
  }
}

