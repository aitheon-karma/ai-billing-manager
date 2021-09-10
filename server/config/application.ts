import * as http from 'http';
import * as path from 'path';
import { environment } from '../environment';
import { ExpressConfig, logger } from '@aitheon/core-server';
import * as docs from '@aitheon/core-server';
import { TransporterBroker } from '@aitheon/transporter';
import { Container } from 'typedi';
import { ServicesService } from '../modules/shared/services/services.service';
export class Application {

  server: http.Server;
  express: ExpressConfig;

  constructor() {
    /**
     * Inner microservices communication via transporter
     */
    const transporter = new TransporterBroker({
      transporterServiceId: `${ environment.service._id }${ environment.production ? '' : '_DEV'}`,
      transporterOptions: environment.rabbitmq
    });
    transporter.start();

    this.express = new ExpressConfig();

    docs.init(this.express.app, () => {
      console.log('Swagger documentation generated');
    });

    Container.get(ServicesService);

    /**
     * Start server
     */
    this.server = this.express.app.listen(environment.port, () => {
      logger.debug(`
        ------------
        ${ environment.service._id } Service Started!
        Express: http://localhost:${ environment.port }
        ${ environment.production ? 'Production: true' : '' }
        ------------
      `);
    });

  }

}
