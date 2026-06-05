import { Client } from './client.entity';
import { ClientConfig } from './clientConfig.entity';
import { Group } from './group.entity';
import { Role } from './role.entity';
import { User } from './user.entity';
import { UserGroupMapping } from './user-group-mapping.entity';

export const ALL_ENTITIES = [
  Client,
  ClientConfig,
  Group,
  Role,
  User,
  UserGroupMapping,
];
