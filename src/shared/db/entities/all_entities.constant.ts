import { AccessLevel } from './access-level.entity';
import { Client } from './client.entity';
import { ClientConfig } from './clientConfig.entity';
import { DataSource } from './data-source.entity';
import { DataSourceType } from './data-source-type.entity';
import { Group } from './group.entity';
import { PasswordHistory } from './passwordHistory.entity';
import { Permission } from './permission.entity';
import { ProductBrowser } from './product-browser.entity';
import { ProductGroup } from './product-group.entity';
import { ProductGroupMember } from './product-group-member.entity';
import { Role } from './role.entity';
import { RolePermissionMapping } from './role-permission-mapping.entity';
import { Scope } from './scope.entity';
import { StatisticalConstantsProfile } from './statistical-constants-profile.entity';
import { ThresholdCondition } from './threshold-condition.entity';
import { ThresholdProfile } from './threshold-profile.entity';
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
  ProductBrowser,
  ProductGroup,
  ProductGroupMember,
  Role,
  RolePermissionMapping,
  Scope,
  StatisticalConstantsProfile,
  ThresholdCondition,
  ThresholdProfile,
  User,
  UserGroupMapping,
];
