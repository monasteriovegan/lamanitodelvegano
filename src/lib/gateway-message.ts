export type GatewayInboundMessage = {
  eventId: string;
  messageId: string;
  remoteJid: string;
  phone: string;
  text: string;
  fromMe: boolean;
  timestamp: string;
  pushName?: string | null;
  source: 'whatsapp-baileys';
};

export type GatewayReply = {
  replyText?: string;
  draftOrder?: {
    id: string;
    summary: string;
    confirmUrl?: string;
    discardUrl?: string;
  };
};
