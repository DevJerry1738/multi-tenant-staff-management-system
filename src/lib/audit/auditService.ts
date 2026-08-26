import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
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
    if (!isSupabaseConfigured) {
      this.logToMock(params);
      return;
    }

    // ── Resolve actor identity from the live auth session ──────────────────
    // The RLS INSERT policy requires actor_user_id = auth.uid().
    // We must NOT trust the caller-supplied actorUserId — derive it here.
    let resolvedUserId: string | null = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      resolvedUserId = sessionData?.session?.user?.id ?? null;
    } catch {
      // Session not available — fall through to mock
    }

    if (!resolvedUserId) {
      this.logToMock(params);
      return;
    }

    const auditRecord = {
      organization_id: params.organizationId,
      actor_user_id: resolvedUserId,          // Always from session, never client-supplied
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
        // RLS blocked or other DB error — fall back to in-memory mock
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
    if (!isSupabaseConfigured) {
      return MOCK_AUDIT_LOGS[orgId] || [];
    }

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Unable to load audit logs.', error);
        return [];
      }
      if (!data) {
        return [];
      }
      return data;
    } catch (error) {
      console.error('Unable to load audit logs.', error);
      return [];
    }
  }
}

export const auditService = new AuditService();
