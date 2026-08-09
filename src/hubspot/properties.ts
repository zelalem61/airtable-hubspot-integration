import type { ObjectType } from '../types.js';
import type { PropertyDefinition } from './client.js';

const text = (name: string, label: string, groupName: string, unique = false): PropertyDefinition => ({
  name, label, groupName, type: 'string', fieldType: 'text', hasUniqueValue: unique,
});
const bool = (name: string, label: string, groupName: string): PropertyDefinition => ({
  name,
  label,
  groupName,
  type: 'bool',
  fieldType: 'booleancheckbox',
  options: [
    { label: 'Yes', value: 'true', displayOrder: 0, hidden: false },
    { label: 'No', value: 'false', displayOrder: 1, hidden: false },
  ],
});
const number = (name: string, label: string, groupName: string): PropertyDefinition => ({
  name, label, groupName, type: 'number', fieldType: 'number',
});
const date = (name: string, label: string, groupName: string): PropertyDefinition => ({
  name, label, groupName, type: 'date', fieldType: 'date',
});

export const HUBSPOT_PROPERTIES: Record<ObjectType, PropertyDefinition[]> = {
  companies: [
    text('source_company_id', 'Source Company ID', 'companyinformation', true),
    bool('is_customer', 'Is Customer', 'companyinformation'),
    text('account_manager_name', 'Account Manager', 'companyinformation'),
    date('renewal_date', 'Renewal Date', 'companyinformation'),
    bool('is_key_account', 'Is Key Account', 'companyinformation'),
  ],
  contacts: [
    text('source_contact_id', 'Source Contact ID', 'contactinformation', true),
    bool('is_subscribed', 'Is Subscribed', 'contactinformation'),
    text('lead_source_detail', 'Lead Source', 'contactinformation'),
    text('preferred_contact_method', 'Preferred Contact Method', 'contactinformation'),
    bool('is_decision_maker', 'Is Decision Maker', 'contactinformation'),
  ],
  deals: [
    text('source_deal_id', 'Source Deal ID', 'dealinformation', true),
    bool('source_is_won', 'Source Is Won', 'dealinformation'),
    text('deal_type_detail', 'Source Deal Type', 'dealinformation'),
    text('deal_region', 'Source Deal Region', 'dealinformation'),
    number('discount_percentage', 'Source Discount Percentage', 'dealinformation'),
  ],
  line_items: [
    text('source_line_item_id', 'Source Line Item ID', 'lineiteminformation', true),
  ],
};
