import type { CreateTicketInput, TicketType } from '../types.js';

export interface TicketValidationSuccess {
  ok: true;
  ticketType: TicketType;
}

export interface TicketValidationFailure {
  ok: false;
  message: string;
}

export type TicketValidationResult =
  | TicketValidationSuccess
  | TicketValidationFailure;

export function validateTicketInput(
  input: CreateTicketInput,
  ticketTypes: TicketType[],
  getTicketTypesToolName: string,
): TicketValidationResult {
  if (!input.ticketTypeId || !input.ticketTypeName) {
    return {
      ok: false,
      message: 'Missing required fields: ticketTypeId and ticketTypeName are required.',
    };
  }

  if (!input.fields || Object.keys(input.fields).length === 0) {
    return {
      ok: false,
      message:
        'No fields provided. Please include the required fields for this ticket type.',
    };
  }

  const ticketType = ticketTypes.find(type => type.id === input.ticketTypeId);

  if (!ticketType) {
    return {
      ok: false,
      message: `Invalid ticket type ID: ${input.ticketTypeId}. Call ${getTicketTypesToolName} to get valid ticket types.`,
    };
  }

  const validFieldIds = new Set(ticketType.formFields.map(field => field.id));
  const providedFieldIds = Object.keys(input.fields);
  const invalidFields = providedFieldIds.filter(
    fieldId => !validFieldIds.has(fieldId),
  );

  if (invalidFields.length > 0) {
    return {
      ok: false,
      message: `Invalid field IDs detected: ${invalidFields.join(', ')}. This ticket type only accepts these field IDs: ${Array.from(validFieldIds).join(', ')}. Please only use field IDs from ${getTicketTypesToolName}.`,
    };
  }

  const missingRequired = ticketType.formFields.filter(
    field => field.required && !(field.id in input.fields),
  );

  if (missingRequired.length > 0) {
    return {
      ok: false,
      message: `Missing required fields: ${missingRequired.map(field => `${field.id} (${field.label})`).join(', ')}. Please provide values for all required fields.`,
    };
  }

  return { ok: true, ticketType };
}
