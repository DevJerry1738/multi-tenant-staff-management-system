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

const getBearerToken = (request: Request) => {
  const value = request.headers.get('Authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : null;
};

const hashToken = async (token: string) => {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const token = getBearerToken(request);
  if (!token) return json({ error: 'Authorization is required.' }, 401);

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object') return json({ error: 'Invalid request.' }, 400);
  if (typeof input.staff_profile_id !== 'string' || typeof input.organization_id !== 'string' || typeof input.email !== 'string') {
    return json({ error: 'Staff invitation details are required.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json({ error: 'Invalid authorization.' }, 401);
  const callerId = callerData.user.id;

  const { data: platformAdmin } = await admin
    .from('platform_admins')
    .select('id')
    .eq('user_id', callerId)
    .eq('status', 'active')
    .maybeSingle();

  let authorized = Boolean(platformAdmin);
  if (!authorized) {
    const { data: member } = await admin
      .from('organization_members')
      .select('id')
      .eq('organization_id', input.organization_id)
      .eq('user_id', callerId)
      .eq('status', 'active')
      .maybeSingle();
    if (member) {
      const { data: adminRole } = await admin
        .from('member_roles')
        .select('roles!inner(name)')
        .eq('organization_member_id', member.id)
        .in('roles.name', ['Organization Admin', 'HR Manager'])
        .maybeSingle();
      authorized = Boolean(adminRole);
    }
  }
  if (!authorized) return json({ error: 'Administrator access is required.' }, 403);

  const { data: staff, error: staffError } = await admin
    .from('staff_profiles')
    .select('id, organization_id, email, account_access_status')
    .eq('id', input.staff_profile_id)
    .eq('organization_id', input.organization_id)
    .single();
  if (staffError || !staff) return json({ error: 'Staff profile not found.' }, 404);

  const roleName = typeof input.role_name === 'string' && input.role_name.trim() ? input.role_name.trim() : 'Staff';
  const { data: role, error: roleError } = await admin
    .from('roles')
    .select('id, name')
    .eq('organization_id', input.organization_id)
    .eq('name', roleName)
    .single();
  if (roleError || !role) return json({ error: 'The selected staff role was not found.' }, 400);

  let invitedUserId: string | null = null;
  try {
    const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'http://localhost:5173';
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      input.email.trim().toLowerCase(),
      { redirectTo: `${appUrl}/reset-password` },
    );
    if (inviteError || !invited.user) return json({ error: inviteError?.message ?? 'Unable to send staff invitation.' }, 400);
    invitedUserId = invited.user.id;

    const { data: membership, error: membershipError } = await admin
      .from('organization_members')
      .insert({ organization_id: input.organization_id, user_id: invitedUserId, status: 'active' })
      .select('id')
      .single();
    if (membershipError || !membership) throw new Error(membershipError?.message ?? 'membership_create_failed');

    const { error: roleAssignmentError } = await admin.from('member_roles').insert({
      organization_member_id: membership.id,
      role_id: role.id,
    });
    if (roleAssignmentError) throw new Error(roleAssignmentError.message);

    const invitationToken = crypto.randomUUID();
    const { error: invitationError } = await admin.from('organization_invitations').insert({
      organization_id: input.organization_id,
      staff_profile_id: staff.id,
      email: input.email.trim().toLowerCase(),
      role_id: role.id,
      invited_by: callerId,
      token_hash: await hashToken(invitationToken),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (invitationError) throw new Error(invitationError.message);

    const { error: staffUpdateError } = await admin
      .from('staff_profiles')
      .update({ organization_member_id: membership.id, account_access_status: 'invited', updated_at: new Date().toISOString() })
      .eq('id', staff.id);
    if (staffUpdateError) throw new Error(staffUpdateError.message);

    return json({ success: true, membership_id: membership.id });
  } catch (error) {
    if (invitedUserId) await admin.auth.admin.deleteUser(invitedUserId);
    await admin.from('staff_profiles').update({ organization_member_id: null, account_access_status: 'no_account' }).eq('id', staff.id);
    return json({ error: error instanceof Error ? error.message : 'Staff invitation could not be completed.' }, 500);
  }
});
