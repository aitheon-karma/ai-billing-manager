import { Schema, Document, Connection } from 'mongoose';
import { JSONSchema } from 'class-validator-jsonschema';
import { IsString, IsMongoId, IsArray, ValidateNested, IsOptional, IsDate, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type, Expose } from 'class-transformer';
import { objectIdStringGetter } from '../shared/helpers';

export enum OPERATION_TYPE {
  UPDATE = 'update',
  CREATE = 'create',
  DELETE = 'delete',
}

export class UpdateOperation {
  @Expose()
  @IsEnum(OPERATION_TYPE)
  op: OPERATION_TYPE;
  @Expose()
  o: any;
  @Expose()
  query: any;
  @Expose()
  @IsString()
  description: string;
}

@JSONSchema({ description: 'SubscriptionOperations' })
export class SubscriptionOperations {

  @Expose()
  @IsOptional()
  @IsMongoId()
  _id: string;

  @Expose()
  @IsOptional()
  @ValidateNested({each: true})
  @Type(() => UpdateOperation)
  operations: Array<UpdateOperation>;

}
const subscriptionOperations = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    auto: true,
    get: objectIdStringGetter
  },
  operations: {
    type: Schema.Types.Mixed,
    required: true
  },
},
{
  timestamps: true,
  collection: 'billing__subscription_operations',
  toObject: {getters: true},
  id: false
});

export type ISubscriptionOperations = Document & SubscriptionOperations;
export const GetSubscriptionOperationsSchema = (connection: Connection) => connection.model<ISubscriptionOperations>('SubscriptionOperations', subscriptionOperations);
