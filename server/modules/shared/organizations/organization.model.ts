import db from '@aitheon/core-server/dist/config/db';
import { GetOrganizationSchema } from '../../../shared_models/models/organization.model';
export const OrganizationSchema = GetOrganizationSchema(db.connection);