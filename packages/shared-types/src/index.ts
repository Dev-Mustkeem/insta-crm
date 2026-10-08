export const USER_ROLES = ["SUPER_ADMIN", "OWNER", "STAFF", "ACCOUNTANT"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APP_PAGES = [
  "DASHBOARD",
  "EVIDENCE_VAULT",
  "EMAIL",
  "LEADS",
  "CONTACTS",
  "BROADCASTS",
  "PIPELINE",
  "TASKS",
  "BILLING",
  "AUDIT",
  "USER_MANAGEMENT",
] as const;
export type AppPage = (typeof APP_PAGES)[number];

export const ACCESS_LEVELS = ["NONE", "READ", "WRITE"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export interface PagePermission {
  page: AppPage;
  access: AccessLevel;
}

export const BUSINESS_TYPES = [
  "retailer",
  "service",
  "distributor",
  "manufacturer",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export interface PublicBusiness {
  id: string;
  name: string;
  businessType: string | null;
  teamSize: number | null;
  onboardingCompletedAt: string | null;
  inventoryEnabled: boolean;
}

export interface InventoryItemSummary {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  sellingPrice: number;
  active: boolean;
  lowStock: boolean;
}

export interface StockMovementSummary {
  id: string;
  itemId: string;
  type: "OPENING" | "PURCHASE" | "ADJUSTMENT" | "SALE";
  quantityDelta: number;
  reason: string | null;
  reference: string | null;
  actorName: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  businessId: string;
  permissions: PagePermission[];
}

export interface OrganizationUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  active: boolean;
  permissions: PagePermission[];
  createdAt: string;
}

export interface OrganizationInvitationSummary {
  id: string;
  email: string;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  permissions: PagePermission[];
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface UserManagementResponse {
  users: OrganizationUser[];
  invitations: OrganizationInvitationSummary[];
}

export interface OrganizationInvitationDetails {
  organizationName: string;
  email: string;
  role: Exclude<UserRole, "SUPER_ADMIN">;
  expiresAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
  business: PublicBusiness;
}

export interface SignupInput {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CompleteBusinessSetupInput {
  businessType: BusinessType;
  teamSize: number;
}

export const CONTACT_SOURCES = [
  "gmail",
  "whatsapp",
  "website",
  "marketplace",
  "walk-in",
  "referral",
  "other",
] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export interface ContactSummary {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: ContactSource;
  tags: string[];
  customFields: Record<string, unknown>;
  assignedTo: {
    id: string;
    name: string;
  };
  creditTermsDays: number;
  gstin: string | null;
  billingStateCode: string | null;
  whatsappOptedOut: boolean;
  leadScore: number;
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ContactListResponse {
  items: ContactSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ContactDuplicateWarning {
  code: "DUPLICATE_PHONE";
  message: string;
  contact: Pick<ContactSummary, "id" | "name" | "phone"> | null;
}

export interface ContactMutationResponse {
  contact: ContactSummary;
  warnings: ContactDuplicateWarning[];
}

export interface ContactInput {
  name: string;
  phone: string;
  email?: string | null;
  source: ContactSource;
  tags: string[];
  customFields: Record<string, unknown>;
  assignedToId?: string;
  creditTermsDays: number;
  gstin?: string | null;
  billingStateCode?: string | null;
  whatsappOptedOut?: boolean;
}

export type PipelineStageCategory = "open" | "won" | "lost";

export interface PipelineStageSummary {
  id: string;
  name: string;
  position: number;
  color: string;
  category: PipelineStageCategory;
}

export interface DealSummary {
  id: string;
  title: string;
  value: number;
  stage: PipelineStageSummary;
  contact: Pick<ContactSummary, "id" | "name" | "phone">;
  assignedTo: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DealListResponse {
  items: DealSummary[];
  total: number;
}

export interface DealInput {
  title: string;
  value: number;
  contactId: string;
  assignedToId?: string;
  stageId?: string;
}

export interface PipelineOptionsResponse {
  stages: PipelineStageSummary[];
  canManageStages: boolean;
  users: Array<{
    id: string;
    name: string;
    role: UserRole;
  }>;
}

export interface DealActivity {
  id: string;
  action: "stage_changed";
  actor: {
    id: string;
    name: string;
  };
  metadata: {
    fromStageId: string;
    fromStageName: string;
    toStageId: string;
    toStageName: string;
  };
  createdAt: string;
}

export interface PipelineStageInput {
  name: string;
  color: string;
  category: PipelineStageCategory;
}

export const TASK_STATUSES = ["pending", "done", "overdue"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_RELATED_ENTITY_TYPES = [
  "contact",
  "deal",
  "invoice",
] as const;
export type TaskRelatedEntityType = (typeof TASK_RELATED_ENTITY_TYPES)[number];

export type TaskSource =
  "manual" | "contact-created" | "stale-deal-stage" | "payment-reminder";

export interface TaskSummary {
  id: string;
  title: string;
  dueAt: string;
  status: TaskStatus;
  source: TaskSource;
  assignedTo: {
    id: string;
    name: string;
  };
  relatedEntity: {
    type: TaskRelatedEntityType;
    id: string;
    label: string;
    href: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  dueAt: string;
  assignedToId?: string;
  relatedEntityType: TaskRelatedEntityType;
  relatedEntityId: string;
}

export interface TaskOptionsResponse {
  users: Array<{
    id: string;
    name: string;
    role: UserRole;
  }>;
}

export type ConversationChannel = "whatsapp" | "sms" | "email" | "call";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "sent" | "delivered" | "read" | "failed";

export interface ConversationSummary {
  id: string;
  channel: ConversationChannel;
  contact: Pick<ContactSummary, "id" | "name" | "phone" | "email">;
  assignedTo: { id: string; name: string } | null;
  lastMessage: {
    body: string;
    direction: MessageDirection;
    status: MessageStatus;
    createdAt: string;
  } | null;
  lastMessageAt: string | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  direction: MessageDirection;
  body: string;
  subject: string | null;
  status: MessageStatus;
  externalMessageId: string | null;
  sentBy: { id: string; name: string } | null;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
}

export interface ConversationNote {
  id: string;
  body: string;
  author: { id: string; name: string };
  createdAt: string;
}

export interface ConversationThreadResponse {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
  notes: ConversationNote[];
}

export interface ConversationSuggestionsResponse {
  enabled: boolean;
  suggestions: string[];
  basedOn?: string;
}

export interface ConversationOptionsResponse {
  users: Array<{ id: string; name: string; role: UserRole }>;
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
  }>;
  canAssign: boolean;
}

export interface CreateConversationInput {
  contactId: string;
  channel: Exclude<ConversationChannel, "call">;
}

export interface WhatsAppTemplateSummary {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  body: string;
  parameterCount: number;
}

export interface WhatsAppSettings {
  configured: boolean;
  provider: "360dialog";
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  reminderTemplateName: string | null;
  reminderTemplateLanguage: string;
  digestTemplateName: string | null;
  digestTemplateLanguage: string;
  enabled: boolean;
}

export interface WhatsAppSettingsInput {
  phoneNumberId: string;
  displayPhoneNumber: string;
  apiKey?: string;
  reminderTemplateName?: string | null;
  reminderTemplateLanguage: string;
  digestTemplateName?: string | null;
  digestTemplateLanguage: string;
  enabled: boolean;
}

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = [
  "cash",
  "upi",
  "bank-transfer",
  "card",
  "cheque",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface InvoiceLineItem {
  inventoryItemId?: string;
  description: string;
  hsnSacCode: string;
  quantity: number;
  rate: number;
  discountPercent?: number;
  discountAmount?: number;
  taxableAmount?: number;
  lineTotal?: number;
  taxPercent: number;
}

export interface InvoiceInput {
  contactId: string;
  dealId?: string | null;
  lineItems: InvoiceLineItem[];
  dueDate: string;
}

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  paidAt: string;
}

export interface PaymentSummary {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  recordedBy: { id: string; name: string };
  createdAt: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  contact: Pick<ContactSummary, "id" | "name" | "phone" | "email">;
  deal: Pick<DealSummary, "id" | "title"> | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: string;
  creditTermsDays: number;
  creditTermsBreached: boolean;
  creditTermsBreachedAt: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  company: {
    name: string;
    email: string | null;
    phone: string | null;
    gstin: string | null;
    stateCode: string | null;
  };
  lineItems: InvoiceLineItem[];
  irn: string | null;
  qrCodeUrl: string | null;
  eInvoiceApplicable: boolean;
  payments: PaymentSummary[];
}

export interface InvoiceListResponse {
  items: InvoiceSummary[];
  total: number;
}

export interface ReceivablesAgingSummary {
  outstanding: number;
  overdue: number;
  buckets: {
    current: number;
    days0To30: number;
    days31To60: number;
    days60Plus: number;
  };
}

export interface BillingOptionsResponse {
  eInvoiceApplicable: boolean;
  company: {
    name: string;
    email: string | null;
    phone: string | null;
    gstin: string | null;
    stateCode: string | null;
  };
  contacts: Array<
    Pick<
      ContactSummary,
      "id" | "name" | "phone" | "creditTermsDays" | "gstin" | "billingStateCode"
    >
  >;
  deals: Array<{
    id: string;
    title: string;
    value: number;
    contactId: string;
    contactName: string;
  }>;
}

export interface InvoicePrefillResponse {
  deal: {
    id: string;
    title: string;
    value: number;
    contact: Pick<ContactSummary, "id" | "name" | "phone">;
  };
  lineItems: InvoiceLineItem[];
  source: "quotation" | "deal";
}

export interface BillingSettings {
  eInvoiceApplicable: boolean;
  gstin: string | null;
  stateCode: string | null;
}

export interface CustomerReceivableSummary {
  contact: Pick<ContactSummary, "id" | "name" | "phone">;
  creditTermsDays: number;
  outstanding: number;
  overdue: number;
  breached: boolean;
  oldestDueDate: string | null;
}

export interface ChannelSettings {
  sms: {
    configured: boolean;
    enabled: boolean;
    flowId: string | null;
    senderId: string | null;
    messageVariable: string;
    webhookConnectionId: string | null;
  };
  email: {
    configured: boolean;
    enabled: boolean;
    fromName: string | null;
    fromEmail: string | null;
    receivingAddress: string | null;
  };
}

export interface ChannelSettingsInput {
  smsAuthKey?: string;
  smsFlowId?: string | null;
  smsSenderId?: string | null;
  smsMessageVariable: string;
  smsWebhookToken?: string;
  smsEnabled: boolean;
  resendApiKey?: string;
  resendFromName?: string | null;
  resendFromEmail?: string | null;
  resendReceivingAddress?: string | null;
  resendWebhookSecret?: string;
  emailEnabled: boolean;
}

export interface AuditLogEntry {
  id: string;
  actor: { id: string; name: string; role: UserRole };
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
}

export interface DashboardSummary {
  openPipeline: { value: number; count: number };
  wonThisMonth: { value: number; count: number };
  overdueTasks: number;
  receivables: ReceivablesAgingSummary;
}

export interface TopCustomerMetric {
  contact: Pick<ContactSummary, "id" | "name" | "phone">;
  dealValue: number;
  dealCount: number;
}

export interface LeadSourceMetric {
  source: ContactSource;
  count: number;
}

export type DashboardDigestFrequency = "daily" | "weekly";
