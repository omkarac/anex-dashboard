import { z } from 'zod';

// Mirrors the DB `role_enum` (0001_initial_schema.sql + 0021_sales_enums_roles.sql).
// Keep this in sync with the Postgres enum — it is the single source of truth for
// role values across the app. Never accept a raw role string into a mutation.
export const TEAM_MEMBER_ROLES = [
  'admin',
  'member',
  'sales_manager',
  'sales_head',
  'sales_admin',
] as const;

export const teamMemberRoleSchema = z.enum(TEAM_MEMBER_ROLES);
export type TeamMemberRole = z.infer<typeof teamMemberRoleSchema>;

// Mirrors the DB CHECK on team_members.department (0027_team_member_department.sql):
// 'cm' (Capital Markets), 'sm' (Sales & Marketing), 'both', or NULL (unassigned).
export const MEMBER_DEPARTMENTS = ['cm', 'sm', 'both'] as const;
export const memberDepartmentSchema = z.enum(MEMBER_DEPARTMENTS).nullable();
export type MemberDepartment = z.infer<typeof memberDepartmentSchema>;
