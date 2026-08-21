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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object') return json({ error: 'Invalid request.' }, 400);

  const required = ['name', 'slug', 'country', 'timezone', 'admin_first_name', 'admin_last_name', 'admin_email', 'admin_password'];
  if (required.some((key) => typeof input[key] !== 'string' || !input[key].trim())) {
    return json({ error: 'Organization and administrator details are required.' }, 400);
  }
  if (input.admin_password.length < 8) return json({ error: 'Administrator password must be at least 8 characters.' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let userId: string | null = null;
  let organizationId: string | null = null;
  try {
    const { data: existingOrg } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', input.slug.trim().toLowerCase())
      .maybeSingle();
    if (existingOrg) return json({ error: 'An organization with this identifier already exists.' }, 409);

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: input.admin_email.trim().toLowerCase(),
      password: input.admin_password,
      email_confirm: true,
      user_metadata: {
        full_name: `${input.admin_first_name.trim()} ${input.admin_last_name.trim()}`,
      },
    });
    if (authError || !authUser.user) return json({ error: 'Unable to create the administrator account.' }, 400);
    userId = authUser.user.id;

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert({
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        country: input.country.trim(),
        timezone: input.timezone.trim(),
        status: 'active',
        setup_completed_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (organizationError || !organization) throw new Error('organization_create_failed');
    organizationId = organization.id;

    const { error: settingsError } = await admin.from('organization_settings').insert({
      organization_id: organization.id,
      attendance_method: input.attendance_method === 'biometric_import' ? 'biometric_import' : 'platform_clocking',
      default_work_start: input.default_work_start || '09:00',
      default_work_end: input.default_work_end || '17:00',
    });
    if (settingsError) throw new Error('settings_create_failed');

    const roleNames = ['Organization Admin', 'HR Manager', 'Manager', 'Staff'];
    const { data: roles, error: rolesError } = await admin
      .from('roles')
      .insert(roleNames.map((name) => ({
        organization_id: organization.id,
        name,
        description: `${name} role`,
        is_system_role: true,
      })))
      .select('*');
    if (rolesError || !roles) throw new Error('roles_create_failed');

    const adminRole = roles.find((role) => role.name === 'Organization Admin');
    if (!adminRole) throw new Error('admin_role_create_failed');

    const { data: member, error: memberError } = await admin
      .from('organization_members')
      .insert({ organization_id: organization.id, user_id: userId, status: 'active' })
      .select('id')
      .single();
    if (memberError || !member) throw new Error('membership_create_failed');

    const { error: memberRoleError } = await admin.from('member_roles').insert({
      organization_member_id: member.id,
      role_id: adminRole.id,
    });
    if (memberRoleError) throw new Error('role_assignment_failed');

    const { data: permissions, error: permissionsError } = await admin.from('permissions').select('id');
    if (permissionsError) throw new Error('permissions_read_failed');
    const { error: permissionLinkError } = await admin.from('role_permissions').insert(
      (permissions ?? []).map((permission) => ({ role_id: adminRole.id, permission_id: permission.id })),
    );
    if (permissionLinkError) throw new Error('permission_assignment_failed');

    const { error: auditError } = await admin.from('audit_logs').insert({
      organization_id: organization.id,
      actor_user_id: userId,
      action: 'organization.created',
      resource_type: 'organizations',
      resource_id: organization.id,
      new_values: { name: organization.name, slug: organization.slug },
    });
    if (auditError) throw new Error('audit_create_failed');

    return json({ organization });
  } catch {
    if (organizationId) await admin.from('organizations').delete().eq('id', organizationId);
    if (userId) await admin.auth.admin.deleteUser(userId);
    return json({ error: 'Organization registration could not be completed.' }, 500);
  }
});
