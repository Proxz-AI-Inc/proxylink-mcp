export interface ConferenceFormField {
  id: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'date'
    | 'email'
    | 'phone'
    | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface RegistrationInterestAction {
  title: string;
  description: string;
  notice?: string;
  formFields: ConferenceFormField[];
}

export interface ConferenceEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  location: string;
  parkingInstructions?: string;
  accessInstructions?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  attendeeNotes?: string;
  registrationInterest: RegistrationInterestAction;
}

export interface ConferenceEventsResponse {
  success: boolean;
  events?: ConferenceEvent[];
  error?: string;
}

export interface ConferenceMemberAction {
  id: string;
  title: string;
  description: string;
  notice?: string;
  formFields: ConferenceFormField[];
}

export interface ConferenceMemberActionsResponse {
  success: boolean;
  actions?: ConferenceMemberAction[];
  error?: string;
}

export interface ConferenceSubmissionResponse {
  success: boolean;
  ticketId?: string;
  message?: string;
  error?: string;
}
