import { createClient } from "@supabase/supabase-js";

import { getServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

export const createServiceClient = () => {
  return createClient(getSupabaseUrl(), getServiceRoleKey());
};
