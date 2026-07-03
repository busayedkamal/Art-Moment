import { supabase } from '../lib/supabase';

export async function logAdminActivity({
  action,
  entityType,
  entityId = null,
  entityLabel = '',
  oldValues = {},
  newValues = {},
  metadata = {},
}) {
  try {
    if (!action || !entityType) return false;

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    const { error } = await supabase
      .from('admin_activity_logs')
      .insert({
        actor_user_id: user?.id || null,
        actor_email: user?.email || null,
        action,
        entity_type: entityType,
        entity_id: entityId ? String(entityId) : null,
        entity_label: entityLabel || null,
        old_values: oldValues || {},
        new_values: newValues || {},
        metadata: metadata || {},
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('admin activity log failed:', error);
    return false;
  }
}
