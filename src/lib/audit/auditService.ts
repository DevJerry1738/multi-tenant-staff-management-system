import { supabase } from '@/lib/supabase/client';
import { MOCK_AUDIT_LOGS } from '@/lib/tenant/mockData';
import type { AuditLog } from '@/types/database';

export interface LogAuditEventParams {
  organizationId: string | null;
  actorUserId?: string | null;
  actorMemberId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

class AuditService {
  async logEvent(params: LogAuditEventParams): Promise<void> {
    const auditRecord = {
      organization_id: params.organizationId,
      actor_user_id: params.actorUserId || null,
      actor_member_id: params.actorMemberId || null,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId || null,
      old_values: params.oldValues || null,
      new_values: params.newValues || null,
      metadata: params.metadata || { timestamp: new Date().toISOString() },
    };

    try {
      const { error } = await supabase.from('audit_logs').insert([auditRecord]);
      if (error) {
        // Fallback to mock logging for local preview
        this.logToMock(params);
      }
    } catch {
      this.logToMock(params);
    }
  }

  private logToMock(params: LogAuditEventParams) {
    const orgId = params.organizationId || 'global';
    if (!MOCK_AUDIT_LOGS[orgId]) {
      MOCK_AUDIT_LOGS[orgId] = [];
    }

    const newLog: AuditLog = {
      id: `audit-${Date.now()}`,
      organization_id: params.organizationId,
      actor_user_id: params.actorUserId || 'usr-current',
      actor_member_id: params.actorMemberId || 'mem-current',
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId || null,
      old_values: params.oldValues || null,
      new_values: params.newValues || null,
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    };

    MOCK_AUDIT_LOGS[orgId].unshift(newLog);
    console.log('[Audit Service]', params.action, params.resourceType, params.resourceId);
  }

  async getAuditLogs(orgId: string): Promise<AuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        return MOCK_AUDIT_LOGS[orgId] || [];
      }
      return data;
    } catch {
      return MOCK_AUDIT_LOGS[orgId] || [];
    }
  }
}

export const auditService = new AuditService();
