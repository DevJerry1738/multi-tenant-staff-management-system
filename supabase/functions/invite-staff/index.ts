import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Extract Bearer token — handles any capitalisation of "Bearer". */
const getBearerToken = (request: Request): string | null => {
  const raw = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith('bearer ')) return trimmed.slice(7).trim();
  return null;
};

Deno.serve(async (request) => {
  // ── CORS pre-flight ────────────────────────────────────────────────────────
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ── Bearer token ───────────────────────────────────────────────────────────
  const token = getBearerToken(request);
  if (!token) {
    console.error('[invite-staff] No bearer token in request');
    return json({ error: 'Authorization is required.' }, 401);
  }

  // ── Body ───────────────────────────────────────────────────────────────────
  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch { return json({ error: 'Invalid JSON body.' }, 400); }

  const { staff_profile_id, organization_id, email, role_name } = input as Record<string, string>;
  if (!staff_profile_id || !organization_id || !email) {
    return json({ error: 'staff_profile_id, organization_id, and email are required.' }, 400);
  }

  // ── Env ────────────────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')              ?? '';
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')         ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceKey) {
    console.error('[invite-staff] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    return json({ error: 'Server configuration error.' }, 500);
  }

  // ── Admin client (service role — never exposed to browser) ─────────────────
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Authenticate caller ────────────────────────────────────────────────────
  let callerId: string | null = null;

  try {
    const { data, error } = await admin.auth.getUser(token);
    if (!error) callerId = data?.user?.id ?? null;
  } catch { /* ignore */ }

  if (!callerId) {
    console.error('[invite-staff] All auth strategies exhausted — no callerId');
    return json({ error: 'Authorization is required.' }, 401);
  }
  console.log('[invite-staff] Authenticated caller ID:', callerId);

  // ── Authorise caller ───────────────────────────────────────────────────────
  // Check if caller is platform admin
  const { data: platformAdmin } = await admin
    .from('platform_admins')
    .select('id')
    .eq('user_id', callerId)
    .eq('status', 'active')
    .maybeSingle();

  let callerMemberId: string | null = null;

  if (!platformAdmin) {
    // Check if caller is active member of target organization
    const { data: member, error: memErr } = await admin
      .from('organization_members')
      .select('id, status')
      .eq('organization_id', organization_id)
      .eq('user_id', callerId)
      .maybeSingle();

    if (memErr) console.error('[invite-staff] membership lookup error:', memErr.message);

    if (!member || member.status !== 'active') {
      console.warn('[invite-staff] Caller', callerId, 'is not an active member of org', organization_id);
      return json({ error: 'You are not an active member of this organization.' }, 403);
    }
    callerMemberId = member.id;

    // Permission check: require the explicit staff.manage_access capability.
    const { data: mrRows } = await admin
      .from('member_roles')
      .select('role_id')
      .eq('organization_member_id', member.id);

    const roleIds = (mrRows || []).map((r) => r.role_id);
    let hasPermission = false;

    if (roleIds.length > 0) {
      const { data: roles } = await admin
        .from('roles')
        .select('id, name')
        .in('id', roleIds);

      const { data: permissionRows } = await admin
        .from('role_permissions')
        .select('role_id, permissions!inner(key)')
        .in('role_id', roleIds);
      hasPermission = (permissionRows || []).some((row) =>
        (row.permissions as { key?: string } | null)?.key === 'staff.manage_access'
      );
    }

    if (!hasPermission) {
      return json({ error: 'You do not have permission to invite staff.' }, 403);
    }
  }

  // ── Verify staff profile belongs to stated org ─────────────────────────────
  const { data: staff, error: staffErr } = await admin
    .from('staff_profiles')
    .select('id, organization_id, email, account_access_status')
    .eq('id', staff_profile_id)
    .eq('organization_id', organization_id)
    .single();

  if (staffErr || !staff) {
    console.error('[invite-staff] staff_profiles lookup failed:', staffErr?.message);
    return json({ error: 'Staff profile not found in this organization.' }, 404);
  }

  // ── Resolve or create role ─────────────────────────────────────────────────
  const targetRoleName = typeof role_name === 'string' && role_name.trim() ? role_name.trim() : 'Staff';
  if (!['Staff', 'Manager'].includes(targetRoleName) && !platformAdmin) {
    return json({ error: 'Only Staff or Manager roles may be assigned by organization users.' }, 403);
  }
  let roleId: string | null = null;

  const { data: existingRole } = await admin
    .from('roles')
    .select('id')
    .eq('organization_id', organization_id)
    .ilike('name', targetRoleName)
    .maybeSingle();

  if (existingRole) {
    roleId = existingRole.id;
  } else {
    const { data: newRole, error: rErr } = await admin
      .from('roles')
      .insert({ organization_id, name: targetRoleName, description: `${targetRoleName} role`, is_system_role: true })
      .select('id').single();
    if (rErr || !newRole) return json({ error: `Could not configure role "${targetRoleName}".` }, 400);
    roleId = newRole.id;
  }

  const rolePermissionKeys: Record<string, string[]> = {
    'Organization Admin': [
      'staff.view', 'staff.create', 'staff.update', 'staff.archive',
      'attendance.view', 'attendance.manage', 'attendance.import',
      'leave.view', 'leave.request', 'leave.approve',
      'documents.view', 'documents.upload', 'documents.delete',
      'announcements.view', 'announcements.create', 'announcements.manage',
      'reports.view', 'reports.export', 'audit_logs.view',
      'organization.view', 'organization.update',
      'departments.view', 'departments.create', 'departments.update', 'departments.archive',
      'teams.view', 'teams.create', 'teams.update', 'teams.archive',
      'roles.view', 'roles.create', 'roles.update', 'roles.delete',
      'settings.view', 'settings.update',
    ],
    'HR Manager': [
      'staff.view', 'staff.create', 'staff.update', 'staff.archive',
      'attendance.view', 'attendance.manage', 'attendance.import',
      'leave.view', 'leave.request', 'leave.approve',
      'documents.view', 'documents.upload', 'documents.delete',
      'announcements.view', 'announcements.create', 'reports.view', 'reports.export',
    ],
    Manager: [
      'staff.view', 'attendance.view', 'attendance.manage',
      'leave.view', 'leave.request', 'leave.approve',
      'documents.view', 'announcements.view', 'reports.view',
    ],
    Staff: ['staff.view', 'attendance.view', 'leave.view', 'leave.request', 'documents.view', 'announcements.view'],
  };
  const permissionKeys = rolePermissionKeys[targetRoleName] ?? [];
  const { data: permissions, error: permissionsError } = await admin
    .from('permissions')
    .select('id')
    .in('key', permissionKeys);
  if (permissionsError) return json({ error: `Could not load permissions for role "${targetRoleName}".` }, 500);
  if (permissions && permissions.length > 0) {
    const { error: permissionAssignmentError } = await admin
      .from('role_permissions')
      .upsert(
        permissions.map((permission) => ({ role_id: roleId, permission_id: permission.id })),
        { onConflict: 'role_id,permission_id', ignoreDuplicates: true },
      );
    if (permissionAssignmentError) return json({ error: 'Could not assign permissions to the selected role.' }, 500);
  }

  // ── Invite via Supabase Auth Admin (uses Resend SMTP) ─────────────────────
  let invitedUserId: string | null = null;
  const cleanEmail = email.trim().toLowerCase();
  const invitationToken = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://multi-tenant-staff-management-syste.vercel.app';
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(
      cleanEmail,
      { redirectTo: `${appUrl}/accept-invitation?token=${invitationToken}` },
    );

    if (invErr) {
      console.warn('[invite-staff] inviteUserByEmail error / notice:', invErr.message);
    }

    if (invited?.user?.id) {
      invitedUserId = invited.user.id;
    }

    // If user already exists in auth.users, fetch their ID
    if (!invitedUserId) {
      const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const foundUser = (userList?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
      if (foundUser) {
        invitedUserId = foundUser.id;
      }
    }

    let membershipId: string | null = null;

    if (invitedUserId) {
      // Find or create membership
      const { data: existingMem } = await admin
        .from('organization_members')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('user_id', invitedUserId)
        .maybeSingle();

      if (existingMem) {
        membershipId = existingMem.id;
      } else {
        const { data: newMem } = await admin
          .from('organization_members')
          .insert({ organization_id, user_id: invitedUserId, status: 'invited' })
          .select('id')
          .single();
        if (newMem) membershipId = newMem.id;
      }

      // Assign role
      if (membershipId && roleId) {
        const { error: roleAssignmentError } = await admin
          .from('member_roles')
          .insert({ organization_member_id: membershipId, role_id: roleId })
        if (roleAssignmentError) throw new Error(roleAssignmentError.message);
      }
    }

    // Always create / update organization_invitations record for token resolution
    const { error: invitationError } = await admin.from('organization_invitations').insert({
      organization_id,
      staff_profile_id: staff.id,
      email: cleanEmail,
      role_id: roleId,
      invited_by: callerId,
      token_hash: await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(invitationToken),
      ).then((digest) => Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (invitationError) throw new Error(invitationError.message);

    // Update staff profile
    await admin
      .from('staff_profiles')
      .update({
        organization_member_id: membershipId,
        account_access_status: 'invited',
        updated_at: new Date().toISOString(),
      })
      .eq('id', staff.id);

    console.log('[invite-staff] Successfully invited staff:', cleanEmail);
    return json({ success: true, membership_id: membershipId });

  } catch (err) {
    console.error('[invite-staff] Transaction exception:', err);
    return json({ error: err instanceof Error ? err.message : 'Staff invitation could not be completed.' }, 500);
  }
});
