import { Analyses } from './analyses.entity';
import { AnalysisFilter } from './analysis_filter.entity';
import { AnnouncementDismissal } from './announcement-dismissal.entity';
import { Announcement } from './announcement.entity';
import { AuditLog } from './audit_log.entity';
import { AuditLogS } from './audit_log_s.entity';
import { DatasourceConnection } from './connections.entity';
import { Dashboard } from './dashboard.entity';
import { DashboardField } from './dashboardField.entity';
import { DashboardFieldRelation } from './dashboardFieldRelation.entity';
import { DashboardFilter } from './dashboardFilter.entity';
import { DashboardVisual } from './dashboardVisual.entity';
import { DashboardVisualConfig } from './dashboardVisualConfig.entity';
import { Dataset } from './dataset.entity';
import { DatasetField } from './datasetField.entity';
import { DatasetFieldRelation } from './datasetFieldRelation.entity';
import { DatasourceConfigS } from './datasourceConfigS.entity';
import { DatasourceS } from './datasourceS.entity';
import { DatasourceAccess } from './datasource_access.entity';
import { Group } from './group.entity';
import { LoginActivity } from './login_activity.entity';
import { LoginActivityS } from './login_activity_s.entity';
import { Client } from './client.entity';
import { ClientConfig } from './clientConfig.entity';
import { PasswordHistory } from './passwordHistory.entity';
import { Prompt } from './prompt.entity';
import { PromptConfig } from './promptConfig.entity';
import { PromptValue } from './promptValue.entity';
import { QueryExecution } from './query-execution.entity';
import { QueryBuilder } from './queryBuilder.entity';
import { QueryBuilderPrompts } from './queryBuilderPrompts.entity';
import { RlsRule } from './rls_rule.entity';
import { Role } from './role.entity';
import { Section } from './section.entity';
import { Tab } from './tab.entity';
import { UserGroupMapping } from './user-group-mapping.entity';
import { User } from './user.entity';
import { Visual } from './visual.entity';
import { VisualConfig } from './visual_config.entity';

export const ALL_ENTITIES = [
  Analyses,
  AnalysisFilter,
  Announcement,
  AnnouncementDismissal,
  AuditLog,
  AuditLogS,
  Dashboard,
  DashboardField,
  DashboardFieldRelation,
  DashboardFilter,
  DashboardVisual,
  DashboardVisualConfig,
  Dataset,
  DatasetField,
  DatasetFieldRelation,
  DatasourceAccess,
  DatasourceConfigS,
  DatasourceConnection,
  DatasourceS,
  Group,
  LoginActivity,
  LoginActivityS,
  Client,
  ClientConfig,
  PasswordHistory,
  Prompt,
  PromptConfig,
  PromptValue,
  QueryBuilder,
  QueryBuilderPrompts,
  QueryExecution,
  RlsRule,
  Role,
  Section,
  Tab,
  User,
  UserGroupMapping,
  Visual,
  VisualConfig,
];
