import { Client } from './client.entity';
import { ClientConfig } from './clientConfig.entity';
import { Group } from './group.entity';
import { Role } from './role.entity';
import { User } from './user.entity';
import { UserGroupMapping } from './user-group-mapping.entity';
import { EventGroup } from './eventGroup.entity';
import { EventGroupMapping } from './eventGroupMapping.entity';
import { MeddraBrowser } from './meddra.entity';
import { ProductBrowser } from './products.entity';
import { ProductGroup } from './productGroup.entity';
import { ProductGroupMapping } from './productGroupMapping.entity';

export const ALL_ENTITIES = [
  Client,
  ClientConfig,
  Group,
  Role,
  User,
  UserGroupMapping,
  MeddraBrowser,
  ProductBrowser,
  ProductGroup,
  ProductGroupMapping,
  EventGroup,
  EventGroupMapping,
];
