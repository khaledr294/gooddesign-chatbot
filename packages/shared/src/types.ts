// ===== Enums =====

export enum FlowState {
  WELCOME = 'WELCOME',
  MAIN_MENU = 'MAIN_MENU',
  CATEGORY_SELECT = 'CATEGORY_SELECT',
  PRODUCT_LIST = 'PRODUCT_LIST',
  PRODUCT_DETAIL = 'PRODUCT_DETAIL',
  CUSTOMIZATION = 'CUSTOMIZATION',
  CUSTOMIZATION_NAME = 'CUSTOMIZATION_NAME',
  CUSTOMIZATION_IMAGE = 'CUSTOMIZATION_IMAGE',
  CUSTOMIZATION_TEXT = 'CUSTOMIZATION_TEXT',
  CUSTOMIZATION_TEMPLATE = 'CUSTOMIZATION_TEMPLATE',
  CUSTOMIZATION_CONFIRM = 'CUSTOMIZATION_CONFIRM',
  CART_REVIEW = 'CART_REVIEW',
  PAYMENT_SELECT = 'PAYMENT_SELECT',
  PAYMENT_TRANSFER = 'PAYMENT_TRANSFER',
  PAYMENT_TRANSFER_RECEIPT = 'PAYMENT_TRANSFER_RECEIPT',
  PAYMENT_SALLA = 'PAYMENT_SALLA',
  ORDER_CONFIRM = 'ORDER_CONFIRM',
  ORDER_TRACKING = 'ORDER_TRACKING',
  ORDER_TRACKING_INPUT = 'ORDER_TRACKING_INPUT',
  FAQ = 'FAQ',
  FAQ_DETAIL = 'FAQ_DETAIL',
  HUMAN_HANDOFF = 'HUMAN_HANDOFF',
  HUMAN_CHAT = 'HUMAN_CHAT',
}

export enum Channel {
  WHATSAPP = 'WHATSAPP',
  WIDGET = 'WIDGET',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  BUTTONS = 'BUTTONS',
  LIST = 'LIST',
  PRODUCT_CARD = 'PRODUCT_CARD',
  TEMPLATE = 'TEMPLATE',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  WAITING_AGENT = 'WAITING_AGENT',
  WITH_AGENT = 'WITH_AGENT',
  CLOSED = 'CLOSED',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  IN_DESIGN = 'IN_DESIGN',
  IN_PRODUCTION = 'IN_PRODUCTION',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  SALLA_CHECKOUT = 'SALLA_CHECKOUT',
}

export enum AgentRole {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
}

// ===== Interfaces =====

export interface BotButton {
  id: string;
  title: string;
}

export interface BotListRow {
  id: string;
  title: string;
  description?: string;
}

export interface BotListSection {
  title: string;
  rows: BotListRow[];
}

export interface BotMessage {
  type: MessageType;
  text?: string;
  imageUrl?: string;
  buttons?: BotButton[];
  listSections?: BotListSection[];
  listButtonText?: string;
  productCard?: ProductCardData;
}

export interface ProductCardData {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  description?: string;
  inStock: boolean;
}

export interface SessionData {
  conversationId: string;
  userId: string;
  channel: Channel;
  flowState: FlowState;
  // Context data for current flow
  selectedCategoryId?: string;
  selectedProductId?: string;
  currentPage?: number;
  // Customization in progress
  customization?: CustomizationData;
  // Cart
  cartItems?: CartItemData[];
  // Order tracking
  trackingOrderId?: string;
  // FAQ
  faqTopic?: string;
  // Agent assignment
  assignedAgentId?: string;
}

export interface CustomizationData {
  productId: string;
  templateId?: string;
  name?: string;
  imageUrl?: string;
  additionalText?: string;
  confirmed: boolean;
}

export interface CartItemData {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  customization?: CustomizationData;
  imageUrl?: string;
}

export interface IncomingMessage {
  channel: Channel;
  senderId: string; // phone number or widget session id
  senderName?: string;
  messageType: 'text' | 'image' | 'document' | 'button_reply' | 'list_reply';
  text?: string;
  buttonReplyId?: string;
  listReplyId?: string;
  mediaUrl?: string;
  timestamp: number;
}

export interface FlowResult {
  messages: BotMessage[];
  newState: FlowState;
  sessionUpdates?: Partial<SessionData>;
}

// ===== Salla Types =====

export interface SallaProduct {
  id: number;
  name: string;
  description: string;
  price: { amount: number; currency: string };
  sale_price?: { amount: number; currency: string };
  images: { url: string; alt?: string }[];
  quantity: number;
  status: string;
  categories: { id: number; name: string }[];
  options?: SallaProductOption[];
}

export interface SallaProductOption {
  id: number;
  name: string;
  values: { id: number; name: string }[];
}

export interface SallaCategory {
  id: number;
  name: string;
  image?: { url: string };
  parent_id?: number;
}

export interface SallaOrderPayload {
  customer: {
    first_name: string;
    last_name: string;
    phone: string;
    email?: string;
    city?: string;
  };
  items: {
    product_id: number;
    quantity: number;
    note?: string;
  }[];
  payment_method?: string;
  note?: string;
}

// ===== Agent Assignment Types =====

export interface AgentInfo {
  id: string;
  name: string;
  role: AgentRole;
  isOnline: boolean;
  activeChats: number;
  maxConcurrentChats: number;
  categoryIds: string[];
}

export interface AssignmentResult {
  assigned: boolean;
  agentId?: string;
  agentName?: string;
  reason?: string; // e.g. "no_agents_online", "all_busy"
}
