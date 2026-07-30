import { z } from 'zod';

const fieldValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const conferenceFormFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum([
    'text',
    'textarea',
    'select',
    'checkbox',
    'date',
    'email',
    'phone',
    'number',
  ]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

const registrationInterestActionSchema = z.object({
  title: z.string(),
  description: z.string(),
  notice: z.string().optional(),
  formFields: z.array(conferenceFormFieldSchema),
});

const conferenceEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  timezone: z.string(),
  location: z.string(),
  parkingInstructions: z.string().optional(),
  accessInstructions: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  attendeeNotes: z.string().optional(),
  registrationInterest: registrationInterestActionSchema,
});

const memberActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  notice: z.string().optional(),
  formFields: z.array(conferenceFormFieldSchema),
});

const fieldsSchema = z
  .record(z.string(), fieldValueSchema)
  .describe(
    'Key-value map using only field IDs returned by the corresponding get tool.',
  );

export const getEventsInputSchema = z.object({});

export const getEventsOutputSchema = z.object({
  success: z.boolean(),
  events: z.array(conferenceEventSchema).optional(),
  message: z.string().optional(),
});

export const submitEventRegistrationInterestInputSchema = z.object({
  eventId: z
    .string()
    .min(1)
    .describe('Exact event ID returned by the get events tool.'),
  fields: fieldsSchema,
});

export const submitEventRegistrationInterestOutputSchema = z.object({
  success: z.boolean(),
  ticketId: z.string().optional(),
  message: z.string(),
});

export const getMemberActionsInputSchema = z.object({});

export const getMemberActionsOutputSchema = z.object({
  success: z.boolean(),
  actions: z.array(memberActionSchema).optional(),
  message: z.string().optional(),
});

export const submitMemberActionInputSchema = z.object({
  actionId: z
    .string()
    .min(1)
    .describe('Exact action ID returned by the get member actions tool.'),
  fields: fieldsSchema,
});

export const submitMemberActionOutputSchema = z.object({
  success: z.boolean(),
  ticketId: z.string().optional(),
  message: z.string(),
});

export type SubmitEventRegistrationInterestInput = z.infer<
  typeof submitEventRegistrationInterestInputSchema
>;

export type SubmitMemberActionInput = z.infer<
  typeof submitMemberActionInputSchema
>;
