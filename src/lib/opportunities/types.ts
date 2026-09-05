export type OpportunityChannel = 'instagram' | 'whatsapp' | 'web';
export type OpportunityStatus = 'open' | 'snoozed' | 'dismissed' | 'converted' | 'expired';
export type OpportunityPriority = 'high' | 'medium' | 'low';
export type OpportunityStage = 'payment_pending' | 'cart_abandoned' | 'shipping_or_price_question' | 'product_interest' | 'general_interest';
export type OpportunitySourceType = 'ad' | 'organic' | 'unknown';

export type OpportunityDetectionInput = {
  channel: OpportunityChannel;
  hasUnpaidOrder: boolean;
  hasPaidOrder: boolean;
  hasCart: boolean;
  cartSubtotal?: number;
  askedPrice: boolean;
  askedShipping: boolean;
  productMentioned: boolean;
  optedOut: boolean;
  rejected: boolean;
  humanTakeover: boolean;
  personal: boolean;
  adSource: boolean;
  lastBusinessMessageAt?: string | null;
  lastCustomerMessageAt?: string | null;
};

export type OpportunityDecision = {
  stage: OpportunityStage;
  score: number;
  priority: OpportunityPriority;
  reasonCode: string;
  reasonSummary: string;
  sourceType: OpportunitySourceType;
};

export type OpportunityRow = {
  id: string;
  business_unit_id: string;
  conversation_id: string;
  customer_id: string | null;
  channel: OpportunityChannel;
  status: OpportunityStatus;
  priority: OpportunityPriority;
  stage: OpportunityStage;
  score: number;
  reason_code: string;
  reason_summary: string;
  source_type: OpportunitySourceType;
  source_campaign: string | null;
  source_ad: string | null;
  product_context: Record<string, unknown>;
  last_customer_message_at: string | null;
  last_business_message_at: string | null;
  last_activity_at: string;
  recommended_at: string | null;
  recommended_channel: OpportunityChannel | null;
  recommended_message: string | null;
  followup_count: number;
  last_followup_at: string | null;
  next_followup_at: string | null;
  snoozed_until: string | null;
  claim_token?: string | null;
  claim_expires_at?: string | null;
  converted_order_id: number | null;
  converted_revenue: number | null;
  recovered_sale: boolean;
};
