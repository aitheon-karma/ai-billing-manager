import { Service, Inject } from 'typedi';
import { Price, PriceSchema, IPrice } from './price.model';
import { TransporterService, Transporter } from '@aitheon/transporter';
import { Container } from 'typedi';


@Transporter()
@Service()
export class PriceService extends TransporterService {

  constructor() {
    super(Container.get('TransporterBroker'));
  }

  async create(price: Price): Promise<IPrice> {
    const createdPrice = await PriceSchema.create(price);
    this.broker.emit('ServicePricesListService.refreshPrices', createdPrice, 'AUTH');
    return createdPrice;
  }

  async getAll() {
    return PriceSchema.find({});
  }

  async findByParam(param: any) {
    return PriceSchema.find(param);
  }

  async delete(priceId: string) {
    const price = await PriceSchema.findOneAndDelete({_id: priceId});
    this.broker.emit('ServicePricesListService.refreshPrices', price, 'AUTH');
    return price;
  }
}
