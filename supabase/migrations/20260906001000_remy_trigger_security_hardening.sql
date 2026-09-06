begin;

-- Trigger functions do not need caller-controlled name resolution.
alter function public.remy_set_cart_commerce_stage() set search_path = public;
alter function public.remy_sync_order_commerce_stage() set search_path = public;

-- This SECURITY DEFINER function is a trigger implementation only. It must not
-- be exposed as a callable PostgREST RPC to visitors or signed-in users.
revoke execute on function public.remy_claim_web_whatsapp_handoff() from public;
revoke execute on function public.remy_claim_web_whatsapp_handoff() from anon;
revoke execute on function public.remy_claim_web_whatsapp_handoff() from authenticated;

commit;
