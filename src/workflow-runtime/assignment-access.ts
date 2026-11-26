import { PrismaService } from '../prisma/prisma.service'
import { assertActivityAssignee } from './assignment-policy'

/** Look up assignees from server-side workflow configuration, scoped to the authenticated account. */
export async function enforceWorkflowAssignee(
  prisma: PrismaService,
  user: { id: string; accountId: string },
  document: { workflow_id: string; current_element_id?: string | null; current_assigned_user_id?: string | null },
): Promise<void> {
  // A nominal assignment takes priority and requires no additional lookup.
  if (document.current_assigned_user_id) {
    assertActivityAssignee({userIds: [], groupIds: [], roleIds: [], areaIds: []}, user, document.current_assigned_user_id)
    return
  }
  const where = { workflow_id: document.workflow_id, element_id: document.current_element_id ?? '' }
  const [users, groups, roles, areas, identity, groupRecords, roleRecords, areaRecords] = await Promise.all([
    prisma.workflow_activity_config_users.findMany({where, select: {user_id: true}}),
    prisma.workflow_activity_config_groups.findMany({where, select: {group_id: true}}),
    prisma.workflow_activity_config_roles.findMany({where, select: {role_id: true}}),
    prisma.workflow_activity_config_areas.findMany({where, select: {area_id: true}}),
    prisma.users.findFirst({where: {id: user.id, account_id: user.accountId, is_active: true}, select: {id: true, role: true, department: true, job_title: true, position: true}}),
    prisma.organization_groups.findMany({where: {account_id: user.accountId, is_active: true}, select: {id: true, member_ids: true}}),
    prisma.organization_roles.findMany({where: {account_id: user.accountId, is_active: true}, select: {id: true, name: true, code: true}}),
    prisma.organization_areas.findMany({where: {account_id: user.accountId, type: 'area', is_active: true}, select: {id: true, name: true, code: true}}),
  ])
  const names = [identity?.role, identity?.job_title, identity?.position].filter(Boolean).map(v => String(v).trim().toLowerCase())
  const departments = [identity?.department].filter(Boolean).map(v => String(v).trim().toLowerCase())
  const memberGroups = groupRecords.filter(group => Array.isArray(group.member_ids) && (group.member_ids as string[]).includes(user.id)).map(group => group.id)
  assertActivityAssignee({
    userIds: users.map(item => item.user_id),
    groupIds: groups.map(item => item.group_id),
    roleIds: roles.map(item => item.role_id),
    areaIds: areas.map(item => item.area_id),
  }, {
    id: identity?.id ?? '',
    groupIds: memberGroups,
    roleIds: roleRecords.filter(role => names.includes(role.name.trim().toLowerCase()) || Boolean(role.code && names.includes(role.code.trim().toLowerCase()))).map(role => role.id),
    areaIds: areaRecords.filter(area => departments.includes(area.name.trim().toLowerCase()) || Boolean(area.code && departments.includes(area.code.trim().toLowerCase()))).map(area => area.id),
  })
}
