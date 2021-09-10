import { Get, Res, Req, JsonController, Authorized, CurrentUser, QueryParam } from 'routing-controllers';
import { Inject } from 'typedi';
import { Request, Response } from 'express';
import { Current, logger } from '@aitheon/core-server';
import { OpenAPI } from 'routing-controllers-openapi';
import * as moment from 'moment';
import { BillingUsageService } from './billing-usage.service';

@Authorized()
@JsonController('/api/usages')
export class BillingUsagesController {


  @Inject()
  usagesService: BillingUsageService;

  @Get('/')
  @OpenAPI({ summary: 'Get Usages by date', operationId: 'usagesByDate' })
  async usagesByDate(@CurrentUser() current: Current, @Res() response: Response, @Req() request: Request, @QueryParam('fromDate') fromDate: string, @QueryParam('toDate') toDate: string) {
    try {
      // tslint:disable-next-line: no-null-keyword
      const organization = current.organization ? current.organization._id : null;
      const user = current.user._id;

      const groupedUsages = await this.usagesService.findByByUserAndOrg( moment(fromDate).startOf('day').toDate(),  moment(toDate).endOf('day').toDate(), user, organization);
      return response.json(groupedUsages);
    } catch (err) {
      logger.error('[BillingUsageService]: Could not get usages', err);
      return response.status(400).send();
    }
  }


}

