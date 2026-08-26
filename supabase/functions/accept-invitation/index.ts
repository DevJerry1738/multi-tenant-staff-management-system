import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const { token, password } = input as { token?: string; password?: string };
  if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
    return json({ error: 'Invitation token and password are required.' }, 400);
  }

  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters long.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server configuration error.' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Fetch and validate invitation token
    const { data: invitation, error: invError } = await admin
      .from('organization_invitations')
      .select('*')
      .eq('token_hash', token.trim())
      .is('accepted_at', null)
      .maybeSingle();

    if (invError || !invitation) {
      return json({ error: 'Invitation link is invalid or has already been used.' }, 400);
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return json({ error: 'This invitation link has expired. Please contact your administrator.' }, 400);
    }

    const email = invitation.email.trim().toLowerCase();
    const orgId = invitation.organization_id;
    const roleId = invitation.role_id;
    const staffProfileId = invitation.staff_profile_id;

    // 2. Resolve Auth User ID (Find or Create in auth.users)
    let authUserId: string | null = null;
    const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = (userList?.users || []).find((u) => u.email?.toLowerCase() === email);

    if (existingUser) {
      authUserId = existingUser.id;
      // Update password & confirm email
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(authUserId, {
        password: password,
        email_confirm: true,
      });
      if (updateAuthError) {
        return json({ error: `Failed to set account password: ${updateAuthError.message}` }, 400);
      }
    } else {
      // Create user with provided password directly
      const { data: newUser, error: createAuthError } = await admin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });
      if (createAuthError || !newUser?.user) {
        return json({ error: `Failed to create user account: ${createAuthError?.message}` }, 400);
      }
      authUserId = newUser.user.id;
    }

    // 3. Link Organization Membership
    let membershipId: string | null = null;
    const { data: existingMember } = await admin
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', authUserId)
      .maybeSingle();

    if (existingMember) {
      membershipId = existingMember.id;
      await admin
        .from('organization_members')
        .update({ status: 'active' })
        .eq('id', membershipId);
    } else {
      const { data: newMember, error: memErr } = await admin
        .from('organization_members')
        .insert({
          organization_id: orgId,
          user_id: authUserId,
          status: 'active',
        })
        .select('id')
        .single();
      if (memErr || !newMember) throw new Error(memErr?.message ?? 'Failed to create membership record.');
      membershipId = newMember.id;
    }

    // 4. Assign Role
    if (membershipId && roleId) {
      try {
        await admin
          .from('member_roles')
          .insert({ organization_member_id: membershipId, role_id: roleId });
      } catch {
        // Ignore duplicate role assignment
      }
    }

    // 5. Update Staff Profile (Link member & set status active)
    const nowIso = new Date().toISOString();
    if (staffProfileId) {
      await admin
        .from('staff_profiles')
        .update({
          organization_member_id: membershipId,
          account_access_status: 'active',
          updated_at: nowIso,
        })
        .eq('id', staffProfileId);
    } else {
      await admin
        .from('staff_profiles')
        .update({
          organization_member_id: membershipId,
          account_access_status: 'active',
          updated_at: nowIso,
        })
        .eq('organization_id', orgId)
        .ilike('email', email);
    }

    // 6. Mark Invitation as Accepted
    await admin
      .from('organization_invitations')
      .update({ accepted_at: nowIso })
      .eq('id', invitation.id);

    // 7. Audit Log
    try {
      await admin.from('audit_logs').insert({
        organization_id: orgId,
        actor_user_id: authUserId,
        actor_member_id: membershipId,
        action: 'invitation.accepted',
        resource_type: 'organization_invitations',
        resource_id: invitation.id,
        new_values: { email: email, accepted_at: nowIso },
      });
    } catch {
      // Ignore audit log error
    }

    console.log('[accept-invitation] Success for:', email);
    return json({ success: true, email: email });

  } catch (err) {
    console.error('[accept-invitation] Exception:', err);
    return json({ error: err instanceof Error ? err.message : 'Account activation failed.' }, 500);
  }
});
