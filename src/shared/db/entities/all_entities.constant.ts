import { AccessLevel } from './access-level.entity';
import { Client } from './client.entity';
import { ClientConfig } from './clientConfig.entity';
import { DataSource } from './data-source.entity';
import { DataSourceType } from './data-source-type.entity';
import { Group } from './group.entity';
import { PasswordHistory } from './passwordHistory.entity';
import { Permission } from './permission.entity';
import { Role } from './role.entity';
import { RolePermissionMapping } from './role-permission-mapping.entity';
import { User } from './user.entity';
import { UserGroupMapping } from './user-group-mapping.entity';

export const ALL_ENTITIES = [
  AccessLevel,
  Client,
  ClientConfig,
  DataSource,
  DataSourceType,
  Group,
  PasswordHistory,
  Permission,
  Role,
  RolePermissionMapping,
  User,
  UserGroupMapping,
];
