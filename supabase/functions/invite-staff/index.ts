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

/** Decode JWT payload (base64url) without signature verification. */
const jwtPayload = (jwt: string): Record<string, unknown> | null => {
  try {
    const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
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
  // Most reliable server-side approach: pass the user JWT explicitly to getUser().
  // Supabase Auth validates the signature (supports ES256 and HS256 alike)
  // because it calls /auth/v1/user with Authorization: Bearer <token>.
  let callerId: string | null = null;

  // Strategy A: admin client getUser(token) — explicit JWT, works for ES256
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error) console.warn('[invite-staff] admin.auth.getUser error:', error.message);
    callerId = data?.user?.id ?? null;
  } catch (e) {
    console.error('[invite-staff] admin.auth.getUser threw:', e);
  }

  // Strategy B: direct HTTP call to /auth/v1/user (bypasses JS client layer)
  if (!callerId) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
        },
      });
      if (res.ok) {
        const user = await res.json();
        callerId = user?.id ?? null;
        console.log('[invite-staff] Strategy B user id:', callerId);
      } else {
        const body = await res.text();
        console.warn('[invite-staff] Strategy B /auth/v1/user returned', res.status, body);
      }
    } catch (e) {
      console.error('[invite-staff] Strategy B fetch threw:', e);
    }
  }

  // Strategy C: decode JWT payload sub, then confirm user exists via admin API
  if (!callerId) {
    const payload = jwtPayload(token);
    console.log('[invite-staff] Strategy C payload:', JSON.stringify(payload));
    if (payload?.sub && typeof payload.sub === 'string' &&
        (payload.role === 'authenticated' || payload.role === 'service_role')) {
      try {
        const { data: adminUser, error: auErr } = await admin.auth.admin.getUserById(payload.sub);
        if (auErr) console.warn('[invite-staff] getUserById error:', auErr.message);
        callerId = adminUser?.user?.id ?? null;
      } catch (e) {
        console.error('[invite-staff] getUserById threw:', e);
      }
    }
  }

  if (!callerId) {
    console.error('[invite-staff] All auth strategies exhausted — no callerId');
    return json({ error: 'Authorization is required.' }, 401);
  }
  console.log('[invite-staff] Authenticated caller:', callerId);

  // ── Authorise caller ───────────────────────────────────────────────────────
  const { data: platformAdmin } = await admin
    .from('platform_admins')
    .select('id')
    .eq('user_id', callerId)
    .eq('status', 'active')
    .maybeSingle();

  let callerMemberId: string | null = null;

  if (!platformAdmin) {
    const { data: member, error: memErr } = await admin
      .from('organization_members')
      .select('id, status')
      .eq('organization_id', organization_id)
      .eq('user_id', callerId)
      .maybeSingle();

    if (memErr) console.error('[invite-staff] membership lookup error:', memErr.message);

    if (!member || member.status !== 'active') {
      console.warn('[invite-staff] Caller', callerId, 'is not an active member of org', organization_id, 'status:', member?.status);
      return json({ error: 'You are not an active member of this organization.' }, 403);
    }
    callerMemberId = member.id;

    // Permission check: does caller have staff.create or a system/admin role?
    const { data: mrRow } = await admin
      .from('member_roles')
      .select('roles:role_id ( name, is_system_role, role_permissions ( permissions:permission_id ( key ) ) )')
      .eq('organization_member_id', member.id)
      .maybeSingle();

    const roleData = (mrRow?.roles as any);
    const roleName2: string  = roleData?.name ?? '';
    const isSystem: boolean  = roleData?.is_system_role ?? false;
    const permKeys: string[] = (roleData?.role_permissions ?? [])
      .map((rp: any) => rp?.permissions?.key)
      .filter(Boolean);

    const hasPermission =
      isSystem ||
      permKeys.includes('staff.create') ||
      ['admin', 'organization admin', 'hr manager'].includes(roleName2.toLowerCase());

    console.log('[invite-staff] role:', roleName2, 'isSystem:', isSystem, 'perms:', permKeys, 'allowed:', hasPermission);

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

  // ── Invite via Supabase Auth Admin (uses Resend SMTP) ─────────────────────
  let invitedUserId: string | null = null;
  try {
    const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'http://localhost:5173';
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${appUrl}/accept-invitation` },
    );
    if (invErr || !invited?.user) {
      console.error('[invite-staff] inviteUserByEmail error:', invErr?.message);
      return json({ error: invErr?.message ?? 'Unable to send staff invitation email.' }, 400);
    }
    invitedUserId = invited.user.id;

    // Membership
    const { data: membership, error: mErr } = await admin
      .from('organization_members')
      .insert({ organization_id, user_id: invitedUserId, status: 'invited' })
      .select('id').single();
    if (mErr || !membership) throw new Error(mErr?.message ?? 'membership_create_failed');

    // Role assignment
    const { error: raErr } = await admin
      .from('member_roles')
      .insert({ organization_member_id: membership.id, role_id: roleId });
    if (raErr) throw new Error(raErr.message);

    // Invitation record
    const { error: irErr } = await admin.from('organization_invitations').insert({
      organization_id,
      staff_profile_id: staff.id,
      email: email.trim().toLowerCase(),
      role_id: roleId,
      invited_by: callerId,
      token_hash: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (irErr) throw new Error(irErr.message);

    // Update staff profile
    const { error: suErr } = await admin
      .from('staff_profiles')
      .update({ organization_member_id: membership.id, account_access_status: 'invited', updated_at: new Date().toISOString() })
      .eq('id', staff.id);
    if (suErr) throw new Error(suErr.message);

    console.log('[invite-staff] Invitation complete for', email, 'membership:', membership.id);
    return json({ success: true, membership_id: membership.id });

  } catch (err) {
    console.error('[invite-staff] Transaction error:', err);
    if (invitedUserId) await admin.auth.admin.deleteUser(invitedUserId).catch(() => undefined);
    await admin.from('staff_profiles')
      .update({ organization_member_id: null, account_access_status: 'no_account' })
      .eq('id', staff.id).catch(() => undefined);
    return json({ error: err instanceof Error ? err.message : 'Staff invitation could not be completed.' }, 500);
  }
});
