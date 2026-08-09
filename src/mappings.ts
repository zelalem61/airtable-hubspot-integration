import { compactProperties, dealStage, normalizeBoolean, normalizeDate, normalizeIndustry, normalizeNumber, stringValue } from './lib/normalize.js';

export function mapCompany(fields: Record<string, unknown>, sourceId: string): Record<string, string> {
  return compactProperties({
    source_company_id: sourceId,
    name: stringValue(fields.company_name),
    domain: stringValue(fields.domain)?.toLowerCase(),
    industry: normalizeIndustry(fields.industry),
    numberofemployees: normalizeNumber(fields.number_of_employees),
    is_customer: normalizeBoolean(fields.is_customer),
    account_manager_name: stringValue(fields.account_manager),
    renewal_date: normalizeDate(fields.renewal_date),
    is_key_account: normalizeBoolean(fields.is_key_account),
  });
}

export function mapContact(fields: Record<string, unknown>, sourceId: string): Record<string, string> {
  return compactProperties({
    source_contact_id: sourceId,
    firstname: stringValue(fields.first_name),
    lastname: stringValue(fields.last_name),
    email: stringValue(fields.email)?.toLowerCase(),
    phone: stringValue(fields.phone),
    lifecyclestage: stringValue(fields.lifecycle_stage),
    is_subscribed: normalizeBoolean(fields.is_subscribed),
    lead_source_detail: stringValue(fields.lead_source),
    preferred_contact_method: stringValue(fields.preferred_contact_method),
    is_decision_maker: normalizeBoolean(fields.is_decision_maker),
  });
}

export function mapDeal(fields: Record<string, unknown>, sourceId: string, integration = false): Record<string, string> {
  return compactProperties({
    source_deal_id: sourceId,
    dealname: stringValue(fields.deal_name),
    amount: normalizeNumber(fields.amount),
    dealstage: integration ? dealStage(fields.status ?? fields.deal_stage) : stringValue(fields.deal_stage),
    closedate: normalizeDate(fields.close_date),
    source_is_won: normalizeBoolean(fields.is_won),
    deal_type_detail: stringValue(fields.deal_type),
    deal_region: stringValue(fields.region),
    discount_percentage: normalizeNumber(fields.discount_percentage),
  });
}

export function mapLineItem(fields: Record<string, unknown>, sourceId: string): Record<string, string> {
  return compactProperties({
    source_line_item_id: sourceId,
    name: stringValue(fields.product_name),
    quantity: normalizeNumber(fields.quantity),
    price: normalizeNumber(fields.unit_price),
  });
}
